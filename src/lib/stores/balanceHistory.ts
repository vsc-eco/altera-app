import moment from 'moment';
import { writable } from 'svelte/store';
import { getBlockHeightFromDate } from '../../routes/(authed)/transactions/getDateFromBlockHeight';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import config from '../../../houdini.config';
import { type Point } from '../LineChart.svelte';
import { type AccountBalance, getDefaultBalance } from './currentBalance';
import { currentGqlUrl } from '../../client';

export type BalanceOption =
	| 'hbd'
	| 'hbd_savings'
	| 'pending_hbd_unstaking'
	| 'hive'
	| 'hive_consensus'
	| 'consensus_unstaking';

// specifically for the graph
type BalanceDataPoint = {
	blockHeight: number;
	timestamp: moment.Moment;
	amount: number; // total amount in USD (sum of converted balances)
};

// svelte store for the balance data
export const accountBalanceHistory = writable<Point[]>([]);

export function isValidBalanceField(value: string): value is BalanceOption {
	return [
		'hbd',
		'hbd_savings',
		'pending_hbd_unstaking',
		'hive',
		'hive_consensus',
		'consensus_unstaking'
	].includes(value as BalanceOption);
}

export async function sumBalance(accBal: AccountBalance): Promise<number> {
	const amts = {
		hive: new CoinAmount(accBal.hive, Coin.hive, true),
		hiveConsensus: new CoinAmount(accBal.hive_consensus, Coin.hive, true),
		hiveUnstaking: new CoinAmount(accBal.consensus_unstaking, Coin.hive, true),
		hbd: new CoinAmount(accBal.hbd, Coin.hbd, true),
		hbdSavings: new CoinAmount(accBal.hbd_savings, Coin.hbd, true),
		hbdUnstaking: new CoinAmount(accBal.pending_hbd_unstaking, Coin.hbd, true),
		btc: new CoinAmount(accBal.btc ?? 0, Coin.sats, true)
	};

	let totalInUSD = new CoinAmount(0, Coin.usd);
	for (const amt of Object.values(amts)) {
		totalInUSD = totalInUSD.add(await amt.convertTo(Coin.usd, Network.lightning));
	}
	return totalInUSD.toNumber();
}

async function getBlockHeightSeries(
	start: Date | moment.Moment,
	end: Date | moment.Moment,
	interval: moment.Duration
): Promise<{ blockHeight: number; timestamp: moment.Moment }[]> {
	const momentStart = moment(start);
	const momentEnd =
		interval.asHours() === 1 ? moment(end).startOf('hour') : moment(end).startOf('day');
	if (!momentStart.isValid() || !momentEnd.isValid()) {
		throw new Error('Invalid period or end time provided');
	}

	const series: { blockHeight: number; timestamp: moment.Moment }[] = [];
	let current = momentEnd.clone();

	while (current.isAfter(momentStart) || current.isSame(momentStart)) {
		const blockHeight = getBlockHeightFromDate(current);
		series.push({
			blockHeight,
			timestamp: current.clone()
		});
		current.subtract(moment.duration(interval));
	}

	return series.reverse();
}

function buildMultiHeightQuery(account: string, blockHeights: number[]): string {
	const aliasedQueries = blockHeights
		.map((height: number) => {
			const alias = `block_${height}`;
			return `
            ${alias}: getAccountBalance(account: "${account}", height: ${height}) {
                pending_hbd_unstaking
                consensus_unstaking
                hbd
                hbd_savings
                hive_consensus
                hive
            }`;
		})
		.join('\n');
	return `query GetAccountBalanceAtMultipleHeights {
        ${aliasedQueries}
    }`;
}

/**
 * Max block heights to request in a single GQL operation.
 * Each alias contributes 1 root selection + 6 sub-selections = 7 field
 * selections. The indexer enforces a 100-selection cap per operation
 * (security hardening), so we keep batches at 12 aliases = 84 selections
 * to leave headroom for any incidental schema growth.
 */
const MAX_HEIGHTS_PER_QUERY = 12;

/**
 * How many batched GQL requests to have in-flight at once. Bounded so a
 * 365-day daily series (≈ 31 batches) doesn't fire 31 simultaneous fetches —
 * browsers cap per-origin connections at ~6 anyway, and the indexer may
 * rate-limit on burst. 4 is conservative and still ~4× faster than serial.
 */
const MAX_PARALLEL_BATCHES = 4;

async function fetchBalancesBatch(
	account: string,
	blockHeights: number[]
): Promise<Record<string, AccountBalance>> {
	const queryString = buildMultiHeightQuery(account, blockHeights);
	const response = await fetch(`${currentGqlUrl}/api/v1/graphql`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query: queryString, variables: {} })
	});
	if (!response.ok) {
		// Swallow HTTP errors per-batch so one bad batch doesn't kill the graph;
		// other batches' data will still render, missing heights show as zero.
		console.error(`Balance batch HTTP error ${response.status}`);
		return {};
	}
	const result = await response.json();
	if (result.errors) {
		console.error('GraphQL errors:', result.errors);
		return {};
	}
	return result.data ?? {};
}

/** Run async tasks with bounded concurrency. Preserves order of results. */
async function runWithConcurrency<T, R>(
	items: T[],
	limit: number,
	task: (item: T) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;
	async function worker() {
		while (true) {
			const i = nextIndex++;
			if (i >= items.length) return;
			results[i] = await task(items[i]);
		}
	}
	const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
	await Promise.all(workers);
	return results;
}

export async function fetchBalancesHTTP(
	account: string,
	start: Date | moment.Moment,
	end: Date | moment.Moment,
	interval: moment.Duration
): Promise<BalanceDataPoint[]> {
	if (!currentGqlUrl || typeof currentGqlUrl !== 'string') {
		throw new Error('No API availabe.');
	}
	const blockHeightSeries = await getBlockHeightSeries(start, end, interval);
	try {
		// Chunk the block-height list into batches small enough to satisfy
		// the indexer's field-selection cap, then run them with bounded
		// concurrency so a 365-day series doesn't flood the connection pool.
		const batches: number[][] = [];
		for (let i = 0; i < blockHeightSeries.length; i += MAX_HEIGHTS_PER_QUERY) {
			batches.push(
				blockHeightSeries.slice(i, i + MAX_HEIGHTS_PER_QUERY).map((s) => s.blockHeight)
			);
		}
		const batchResults = await runWithConcurrency(batches, MAX_PARALLEL_BATCHES, (batch) =>
			fetchBalancesBatch(account, batch)
		);
		// Merge all batch maps into one alias → balance lookup.
		const merged: Record<string, AccountBalance> = Object.assign({}, ...batchResults);

		// Process the merged response.
		const processed = await Promise.all(
			blockHeightSeries.map(async (item) => {
				const alias = `block_${item.blockHeight}`;
				const balanceData: AccountBalance = merged[alias] || getDefaultBalance();
				const totalAmount = await sumBalance(balanceData);
				return {
					blockHeight: item.blockHeight,
					timestamp: item.timestamp,
					amount: totalAmount
				};
			})
		);
		return processed;
	} catch (error) {
		console.error('Failed to fetch balances with raw fetch:', error);
		return [];
	}
}

export async function fetchAndStoreAccountBalances(
	account: string,
	start: Date | moment.Moment,
	end: Date | moment.Moment,
	interval: moment.Duration
): Promise<void> {
	try {
		const data = await fetchBalancesHTTP(account, start, end, interval);

		accountBalanceHistory.set(
			data.map(
				(dp): Point => ({
					value: dp.amount,
					date: dp.timestamp.toDate()
				})
			)
		);
	} catch (error) {
		console.error('Failed to fetch and store balances:', error);
		accountBalanceHistory.set([]);
	}
}
