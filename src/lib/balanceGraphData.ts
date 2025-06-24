import moment from 'moment';
import { writable } from 'svelte/store';
import { getBlockHeightFromDate } from '../routes/(authed)/transactions/getDateFromBlockHeight';
import { CoinAmount } from './currency/CoinAmount';
import { Coin, Network } from './send/sendOptions';
import config from '../../houdini.config';
import { type Point } from './LineChart.svelte';

type AccountBalance = {
	hbd: number;
	hbd_savings: number;
	pending_hbd_unstaking: number;
	hive: number;
	hive_consensus: number;
	consensus_unstaking: number;
};

type BalanceDataPoint = {
	blockHeight: number;
	timestamp: moment.Moment;
	amount: number; // Total amount in USD
};

// Svelte store for the balance data
export const accountBalanceStore = writable<Point[]>([]);

async function sumBalance(accBal: AccountBalance): Promise<number> {
	const amts = {
		hive: new CoinAmount(accBal.hive, Coin.hive, true),
		hiveConsensus: new CoinAmount(accBal.hive_consensus, Coin.hive, true),
		hiveUnstaking: new CoinAmount(accBal.consensus_unstaking, Coin.hive, true),
		hbd: new CoinAmount(accBal.hbd, Coin.hbd, true),
		hbdSavings: new CoinAmount(accBal.hbd_savings, Coin.hbd, true),
		hbdUnstaking: new CoinAmount(accBal.pending_hbd_unstaking, Coin.hbd, true)
	};

	let totalInUSD = new CoinAmount(0, Coin.usd);
	for (const amt of Object.values(amts)) {
		totalInUSD = totalInUSD.add(await amt.convertTo(Coin.usd, Network.lightning));
	}
	return totalInUSD.toNumber();
}

function getBlockHeightSeries(
	start: Date | moment.Moment,
	end: Date | moment.Moment,
	interval: moment.Duration
): { blockHeight: number; timestamp: moment.Moment }[] {
	const momentStart = moment(start);
	const momentEnd = moment(end);
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

export async function fetchBalancesHTTP(
	account: string,
	start: Date | moment.Moment,
	end: Date | moment.Moment,
	interval: moment.Duration
): Promise<BalanceDataPoint[]> {
	const graphqlEndpoint = config.watchSchema.url;
	const blockHeightSeries = getBlockHeightSeries(start, end, interval);
	const blockHeights = blockHeightSeries.map((item) => item.blockHeight);
	const queryString = buildMultiHeightQuery(account, blockHeights);
	try {
		const response = await fetch(graphqlEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query: queryString,
				variables: {}
			})
		});
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const result = await response.json();
		if (result.errors) {
			console.error('GraphQL errors:', result.errors);
			return [];
		}

		// Process the response
		const processed = await Promise.all(
			blockHeightSeries.map(async (item) => {
				const alias = `block_${item.blockHeight}`;
				const balanceData: AccountBalance = result.data?.[alias] || getDefaultBalance();
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

function getDefaultBalance(): AccountBalance {
	return {
		hbd: 0,
		hbd_savings: 0,
		pending_hbd_unstaking: 0,
		hive: 0,
		hive_consensus: 0,
		consensus_unstaking: 0
	};
}

export async function fetchAndStoreAccountBalances(
	account: string,
	start: Date | moment.Moment,
	end: Date | moment.Moment,
	interval: moment.Duration
): Promise<void> {
	try {
		const data = await fetchBalancesHTTP(account, start, end, interval);

		accountBalanceStore.set(
			data.map(
				(dp): Point => ({
					value: dp.amount,
					date: dp.timestamp.toDate()
				})
			)
		);
	} catch (error) {
		console.error('Failed to fetch and store balances:', error);
		accountBalanceStore.set([]);
	}
}
