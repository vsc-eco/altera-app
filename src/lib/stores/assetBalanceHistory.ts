import moment from 'moment';
import { getHbdAssetName, getHiveAssetName } from '../../client';
import { getCryptoPrices } from '$lib/sendswap/v4v/api-types/cryptoprices';
import { btcBalanceAt, fetchBtcBalanceDeltas } from '$lib/indexer/btcBalanceHistory';
import { fetchAccountBalanceSeries } from './balanceHistory';

/** The three assets a Magi account can hold, as the Balance card lists them.
 *  The key is the colour-slot identity: it never changes with row order, so a
 *  user who learns "HIVE is orange" keeps reading the chart the same way. */
export type AssetKey = 'hbd' | 'hive' | 'btc';

export type AssetSeries = {
	key: AssetKey;
	/** Display name, testnet-aware (TBD / TESTS). */
	label: string;
	/** Unit suffix for the native readout. */
	unit: string;
	decimals: number;
	/** Balance in native display units at each sampled date. */
	amounts: number[];
	/** The same balance valued in USD. */
	usd: number[];
};

export type AssetBalanceHistory = {
	dates: Date[];
	series: AssetSeries[];
	/** False when the price feed was unreachable, so USD figures are unusable. */
	pricesOk: boolean;
};

const EMPTY: AssetBalanceHistory = { dates: [], series: [], pricesOk: true };

/**
 * Per-asset balance history for one account.
 *
 * HIVE and HBD come from `getAccountBalance(account, height:)`, which the node
 * answers exactly at any past height, summed across their sub-balances
 * (liquid + staked/savings + unstaking) because those are states of one asset,
 * not separate assets. BTC has no height-addressable source — the mapping
 * contract's state can only be read at the head — so it is replayed from the
 * contract's event log instead; see `btcBalanceHistory.ts`.
 *
 * USD figures use the CURRENT price for every point: the only historical price
 * feed in the app covers the last 24h at 15-minute steps, which cannot value a
 * 90-day series. So the curve's shape is the balance moving, not the market —
 * which is what "balance over time" should show. Callers must say so in the UI.
 */
export async function fetchAssetBalanceHistory(
	did: string,
	start: Date | moment.Moment,
	end: Date | moment.Moment,
	interval: moment.Duration
): Promise<AssetBalanceHistory> {
	if (!did) return EMPTY;

	const [samples, btcDeltas, prices] = await Promise.all([
		fetchAccountBalanceSeries(did, start, end, interval),
		fetchBtcBalanceDeltas(did).catch((err) => {
			console.error('Failed to replay BTC balance history', err);
			return [];
		}),
		getCryptoPrices().catch((err) => {
			console.error('Failed to fetch prices for the asset balance chart', err);
			return null;
		})
	]);

	if (samples.length === 0) return EMPTY;

	const dates = samples.map((s) => s.timestamp.toDate());
	const usdPerHive = prices?.hive?.usd ?? 0;
	const usdPerHbd = prices?.hive_dollar?.usd ?? 0;
	const usdPerBtc = prices?.bitcoin?.usd ?? 0;

	const hbdUnits = samples.map(
		(s) =>
			(num(s.balance.hbd) + num(s.balance.hbd_savings) + num(s.balance.pending_hbd_unstaking)) /
			1e3
	);
	const hiveUnits = samples.map(
		(s) =>
			(num(s.balance.hive) + num(s.balance.hive_consensus) + num(s.balance.consensus_unstaking)) /
			1e3
	);
	const btcUnits = btcBalanceAt(btcDeltas, dates).map((sats) => sats / 1e8);

	const series: AssetSeries[] = [
		{
			key: 'hbd',
			label: getHbdAssetName(),
			unit: getHbdAssetName(),
			decimals: 3,
			amounts: hbdUnits,
			usd: hbdUnits.map((a) => a * usdPerHbd)
		},
		{
			key: 'hive',
			label: getHiveAssetName(),
			unit: getHiveAssetName(),
			decimals: 3,
			amounts: hiveUnits,
			usd: hiveUnits.map((a) => a * usdPerHive)
		},
		{
			key: 'btc',
			label: 'Bitcoin',
			unit: 'BTC',
			decimals: 8,
			amounts: btcUnits,
			usd: btcUnits.map((a) => a * usdPerBtc)
		}
	];

	return {
		dates,
		series,
		pricesOk: usdPerHive > 0 && usdPerHbd > 0 && usdPerBtc > 0
	};
}

function num(v: number | null | undefined): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
