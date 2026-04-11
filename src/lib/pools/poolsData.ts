import { GetStateByKeysStore } from '$houdini';
import { getCryptoPrices } from '$lib/sendswap/v4v/api-types/cryptoprices';

export type TimeRange = '1d' | '7d' | '30d' | 'max';

export interface PoolRow {
	id: string;
	contractId: string;
	pair: string;
	pairSymbols: [string, string];
	priceRatio: string;
	priceInverse: string;
	priceUsd: [string, string];
	totalLiquidityUsd: string;
	totalLiquidityAssets: [string, string];
	feeEarnedUsd: string;
	feeEarnedAssets: [string, string];
	volumeUsd: string;
	volumeAssets: [string, string];
}

// HIVE/HBD DEX:
export const HIVE_HBD_POOL_CONTRACT_ID = 'vsc1Brm1QpGF8WXvRCvwgbpB6fiHtTBJzyZUC9';

// BTC/HBD DEX:
export const HBD_BTC_POOL_CONTRACT_ID = 'vsc1BgwiEg8P5u2qYSV7DL8FCqrj5E7hWSYKmf';

// BTC Mapping contract (ERC-20 style approve/transfer for BTC):
export const BTC_MAPPING_CONTRACT_ID = 'vsc1BYBwMvsSFwqvwzio352VWp6fGkjVs7t3Dp';

export const HBD_BTC_POOL_KEYS = [
	'reserve0',
	'reserve1',
	'total_lp',
	'asset0',
	'asset1',
	'fee',
	'lp/',
	'fee0',
	'fee1',
	'clp0',
	'clp1',
	'fee_last_claim',
	'asset/',
	'bal/'
] as const;

const HASURA_INDEXER_URL = 'https://magidev.okinoko.io/hasura/v1/graphql';

type PoolState = Record<string, string | null | undefined>;

function parseScaled(raw: string | null | undefined, decimals = 3): number | null {
	if (raw == null) return null;
	const n = Number(raw);
	if (!Number.isFinite(n)) return null;
	return n / 10 ** decimals;
}

function formatNum(value: number, unit: string, decimals = 3): string {
	const formatted = value.toLocaleString(undefined, {
		useGrouping: true,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
	return unit === '$' ? `$${formatted}` : `${formatted} ${unit.toUpperCase()}`;
}

// --- Hasura indexer queries ---

function getTimeGte(range: TimeRange): string | null {
	if (range === 'max') return null;
	const now = new Date();
	const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
	now.setDate(now.getDate() - days);
	return now.toISOString();
}

interface AggregateResult {
	aggregate: {
		count?: number;
		sum?: Record<string, number | null>;
	};
}

async function hasuraQuery(query: string, variables: Record<string, unknown>) {
	const res = await fetch(HASURA_INDEXER_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables })
	});
	const json = await res.json();
	if (json.errors) {
		console.error('Hasura query error:', json.errors);
	}
	return json.data;
}

async function fetchPoolVolume(
	poolId: string,
	range: TimeRange
): Promise<{ count: number; amountIn: number; amountOut: number }> {
	const gte = getTimeGte(range);
	const whereClause = gte
		? `{indexer_contract_id: {_eq: $pool}, indexer_ts: {_gte: "${gte}"}}`
		: `{indexer_contract_id: {_eq: $pool}}`;

	const query = `
		query PoolVolume($pool: String!) {
			result: dex_pool_swap_events_aggregate(where: ${whereClause}) {
				aggregate { count sum { amount_in amount_out } }
			}
		}
	`;
	const data = await hasuraQuery(query, { pool: poolId });
	const agg = (data?.result as AggregateResult)?.aggregate;
	return {
		count: agg?.count ?? 0,
		amountIn: agg?.sum?.amount_in ?? 0,
		amountOut: agg?.sum?.amount_out ?? 0
	};
}

async function fetchPoolFees(
	poolId: string,
	range: TimeRange
): Promise<{ totalFee: number; magiFee: number; lpFee: number }> {
	const gte = getTimeGte(range);
	const whereClause = gte
		? `{indexer_contract_id: {_eq: $pool}, indexer_ts: {_gte: "${gte}"}}`
		: `{indexer_contract_id: {_eq: $pool}}`;

	const query = `
		query PoolFees($pool: String!) {
			result: dex_pool_fee_events_aggregate(where: ${whereClause}) {
				aggregate { sum { total_fee magi_fee lp_fee } }
			}
		}
	`;
	const data = await hasuraQuery(query, { pool: poolId });
	const sum = (data?.result as AggregateResult)?.aggregate?.sum;
	return {
		totalFee: sum?.total_fee ?? 0,
		magiFee: sum?.magi_fee ?? 0,
		lpFee: sum?.lp_fee ?? 0
	};
}

async function fetchPoolLiquidity(
	poolId: string
): Promise<{ netAmount0: number; netAmount1: number; netLp: number }> {
	const query = `
		query PoolLiquidity($pool: String!) {
			adds: dex_pool_add_liq_events_aggregate(where: {indexer_contract_id: {_eq: $pool}}) {
				aggregate { sum { amount0 amount1 lp_minted } }
			}
			removes: dex_pool_rem_liq_events_aggregate(where: {indexer_contract_id: {_eq: $pool}}) {
				aggregate { sum { amount0 amount1 lp_burned } }
			}
		}
	`;
	const data = await hasuraQuery(query, { pool: poolId });
	const adds = (data?.adds as AggregateResult)?.aggregate?.sum;
	const removes = (data?.removes as AggregateResult)?.aggregate?.sum;
	return {
		netAmount0: (adds?.amount0 ?? 0) - (removes?.amount0 ?? 0),
		netAmount1: (adds?.amount1 ?? 0) - (removes?.amount1 ?? 0),
		netLp: (adds?.lp_minted ?? 0) - (removes?.lp_burned ?? 0)
	};
}

function mapStateToPoolRow(
	poolContractId: string,
	state: PoolState,
	indexerData: {
		volume: { count: number; amountIn: number; amountOut: number };
		fees: { totalFee: number; magiFee: number; lpFee: number };
		liquidity: { netAmount0: number; netAmount1: number; netLp: number };
	},
	usdPrices: { hive: number; hbd: number; btc: number },
	fallbackSymbols?: [string, string]
): PoolRow {
	const asset0Json = state['asset0'];
	const asset1Json = state['asset1'];
	const asset0 = asset0Json ? JSON.parse(asset0Json) : null;
	const asset1 = asset1Json ? JSON.parse(asset1Json) : null;
	const sym0 = (asset0?.asset as string | undefined)?.toUpperCase?.() ?? fallbackSymbols?.[0] ?? 'HBD';
	const sym1 = (asset1?.asset as string | undefined)?.toUpperCase?.() ?? fallbackSymbols?.[1] ?? 'BTC';
	const pairSym0 = `${sym0}`;
	const pairSym1 = `${sym1}`;

	function decimalPlaces(sym: string): number {
		return sym.toUpperCase() === 'BTC' ? 8 : 3;
	}
	const dec0 = decimalPlaces(sym0);
	const dec1 = decimalPlaces(sym1);

	const reserve0 = parseScaled(state['reserve0'], dec0);
	const reserve1 = parseScaled(state['reserve1'], dec1);

	// USD prices per unit — look up by symbol
	function getUsdPrice(sym: string): number {
		const s = sym.toUpperCase();
		if (s === 'HIVE') return usdPrices.hive;
		if (s === 'HBD') return usdPrices.hbd;
		if (s === 'BTC') return usdPrices.btc;
		return 0;
	}
	const usd0 = getUsdPrice(sym0);
	const usd1 = getUsdPrice(sym1);

	// Price ratio: prefer on-chain reserves, fall back to USD price ratio
	let ratio: number | null =
		reserve0 != null && reserve0 !== 0 && reserve1 != null ? reserve1 / reserve0 : null;
	let inverse: number | null =
		reserve1 != null && reserve1 !== 0 && reserve0 != null ? reserve0 / reserve1 : null;

	if (ratio == null && usd0 > 0 && usd1 > 0) {
		ratio = usd0 / usd1;
		inverse = usd1 / usd0;
	}

	const priceRatio =
		ratio != null ? `${ratio.toFixed(8)} ${pairSym1}/${pairSym0}` : '-';
	const priceInverse =
		inverse != null ? `${inverse.toFixed(8)} ${pairSym0}/${pairSym1}` : '-';

	// Liquidity from indexer (net adds - removes)
	const { liquidity, volume, fees } = indexerData;
	const liqAmt0 = liquidity.netAmount0 / 10 ** dec0;
	const liqAmt1 = liquidity.netAmount1 / 10 ** dec1;
	const totalLiquidityAssets: [string, string] = [
		formatNum(liqAmt0, sym0, dec0),
		formatNum(liqAmt1, sym1, dec1)
	];

	// Fees from indexer — all fee values are denominated in sym0 (dec0)
	const feeTotal = fees.totalFee / 10 ** dec0;
	const feeLp = fees.lpFee / 10 ** dec0;
	const feeMagi = fees.magiFee / 10 ** dec0;
	const feeEarnedAssets: [string, string] = [
		formatNum(feeLp, sym0, dec0),
		formatNum(feeMagi, sym0, dec0)
	];

	// Volume from indexer
	const volIn = volume.amountIn / 10 ** dec0;
	const volOut = volume.amountOut / 10 ** dec1;
	const volumeAssets: [string, string] = [
		formatNum(volIn, sym0, dec0),
		formatNum(volOut, sym1, dec1)
	];

	// Compute USD totals
	const totalLiquidityUsd = liqAmt0 * usd0 + liqAmt1 * usd1;
	const feeEarnedUsdTotal = feeTotal * usd0;
	const volumeUsdTotal = volIn * usd0 + volOut * usd1;

	return {
		id: poolContractId,
		contractId: poolContractId,
		pair: `${pairSym0}:${pairSym1}`,
		pairSymbols: [pairSym0, pairSym1],
		priceRatio,
		priceInverse,
		priceUsd: [formatNum(usd0, '$', 2), formatNum(usd1, '$', 2)],
		totalLiquidityUsd: formatNum(totalLiquidityUsd, '$', 2),
		totalLiquidityAssets,
		feeEarnedUsd: formatNum(feeEarnedUsdTotal, '$', 2),
		feeEarnedAssets,
		volumeUsd: formatNum(volumeUsdTotal, '$', 2),
		volumeAssets
	};
}

// Pool definitions: contract ID + fallback symbols
const POOL_CONFIGS = [
	{ contractId: HBD_BTC_POOL_CONTRACT_ID, symbols: ['HBD', 'BTC'] as [string, string] },
	{ contractId: HIVE_HBD_POOL_CONTRACT_ID, symbols: ['HIVE', 'HBD'] as [string, string] }
];

async function fetchSinglePool(
	contractId: string,
	fallbackSymbols: [string, string],
	range: TimeRange,
	usdPrices: { hive: number; hbd: number; btc: number }
): Promise<PoolRow> {
	const [stateRes, volume, fees, liquidity] = await Promise.all([
		new GetStateByKeysStore().fetch({
			variables: { contractId, keys: [...HBD_BTC_POOL_KEYS] },
			policy: 'NetworkOnly'
		}),
		fetchPoolVolume(contractId, range),
		fetchPoolFees(contractId, range),
		fetchPoolLiquidity(contractId)
	]);

	const state = (stateRes.data?.getStateByKeys ?? {}) as PoolState;
	return mapStateToPoolRow(contractId, state, { volume, fees, liquidity }, usdPrices, fallbackSymbols);
}

export async function fetchPools(range: TimeRange = '30d'): Promise<PoolRow[]> {
	try {
		const prices = await getCryptoPrices();
		const usdPrices = {
			hive: prices.hive?.usd ?? 0,
			hbd: prices.hive_dollar?.usd ?? 0,
			btc: prices.bitcoin?.usd ?? 0
		};

		const poolRows = await Promise.all(
			POOL_CONFIGS.map((cfg) =>
				fetchSinglePool(cfg.contractId, cfg.symbols, range, usdPrices)
			)
		);

		return poolRows;
	} catch (err) {
		console.error('Failed to fetch pool state', err);
		return [];
	}
}
