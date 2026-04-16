import { GetStateByKeysStore } from '$houdini';
import { getCryptoPrices } from '$lib/sendswap/v4v/api-types/cryptoprices';
import {
	type TimeRange,
	fetchPoolVolume,
	fetchPoolFees,
	fetchPoolLiquidity,
	fetchPoolLiquiditySnapshot,
	fetchPoolRegistry,
	fetchUserLpPositions,
	type UserLpPosition,
	type PoolRegistryEntry
} from '$lib/indexer/poolQueries';

export type { TimeRange, UserLpPosition, PoolRegistryEntry } from '$lib/indexer/poolQueries';
export { fetchPoolRegistry, fetchPoolLiquiditySnapshot } from '$lib/indexer/poolQueries';

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
	// Raw chain-state values used by per-user computations (My Pools).
	reserve0Raw: number;
	reserve1Raw: number;
	totalLpRaw: number;
	decimals0: number;
	decimals1: number;
	usdPrice0: number;
	usdPrice1: number;
}

// Pool contract IDs are discovered dynamically via fetchPoolRegistry()
// against the Magi indexer — no more hardcoded mainnet-only constants.
// BTC Mapping contract lives in `$lib/stores/currentBalance` and is
// network-switched there. Import `BTC_MAPPING_CONTRACT_ID` from that module.

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

function mapStateToPoolRow(
	poolContractId: string,
	state: PoolState,
	indexerData: {
		volume: { count: number; amountIn: number; amountOut: number };
		fees: { totalFee: number; magiFee: number; lpFee: number };
		liquidity: {
			netAmount0: number;
			netAmount1: number;
			netLp: number;
			snapshot: { reserve0: number; reserve1: number; totalLp: number } | null;
		};
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

	// Prefer chain-state reserves; fall back to the indexer snapshot
	// (dex_pool_liquidity). The chain-state path can return null for
	// pools whose state isn't exposed via getStateByKeys on some APIs
	// (observed on testnet BTC:HBD), so the snapshot fallback keeps
	// per-user share math working.
	const snapshot = indexerData.liquidity.snapshot;
	const reserve0 =
		parseScaled(state['reserve0'], dec0) ??
		(snapshot ? snapshot.reserve0 / 10 ** dec0 : null);
	const reserve1 =
		parseScaled(state['reserve1'], dec1) ??
		(snapshot ? snapshot.reserve1 / 10 ** dec1 : null);

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

	// Liquidity: prefer authoritative on-chain reserves (parsed above) over
	// the indexer's adds-removes sum, which can drift if events are missing
	// or out-of-order. Fall back to the indexer numbers if chain state is
	// unavailable for any reason.
	const { liquidity, volume, fees } = indexerData;
	const idxAmt0 = liquidity.netAmount0 / 10 ** dec0;
	const idxAmt1 = liquidity.netAmount1 / 10 ** dec1;
	const liqAmt0 = reserve0 != null ? reserve0 : idxAmt0;
	const liqAmt1 = reserve1 != null ? reserve1 : idxAmt1;
	const totalLiquidityAssets: [string, string] = [
		formatNum(liqAmt0, sym0, dec0),
		formatNum(liqAmt1, sym1, dec1)
	];

	// Raw smallest-units values + total_lp from chain state for per-user math.
	const reserve0Raw = (reserve0 ?? idxAmt0) * 10 ** dec0;
	const reserve1Raw = (reserve1 ?? idxAmt1) * 10 ** dec1;
	const totalLpRawParsed = Number(state['total_lp']);
	const totalLpRaw = Number.isFinite(totalLpRawParsed) && totalLpRawParsed > 0
		? totalLpRawParsed
		: snapshot?.totalLp ?? 0;

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
		volumeAssets,
		reserve0Raw,
		reserve1Raw,
		totalLpRaw,
		decimals0: dec0,
		decimals1: dec1,
		usdPrice0: usd0,
		usdPrice1: usd1
	};
}

/** Per-user view of a pool position: how much of each asset the user
 *  effectively holds in the pool, plus their LP token balance and share. */
export interface MyPoolRow {
	id: string;
	contractId: string;
	pair: string;
	pairSymbols: [string, string];
	lpBalance: number;
	totalLp: number;
	sharePct: number; // 0..100
	myAmounts: [string, string]; // formatted with units
	myAmountsRaw: [number, number]; // unscaled display units
	myLiquidityUsd: string;
}

/**
 * Resolve the authed user's LP positions into per-pool rows showing THEIR
 * liquidity (not global). Reads chain-state reserves and total_lp from the
 * already-fetched `pools` array — same source of truth as the global Pools
 * table — and only queries the indexer for the user's lp_balance.
 */
export async function fetchMyPoolPositions(
	did: string,
	pools: PoolRow[]
): Promise<MyPoolRow[]> {
	if (!did || pools.length === 0) return [];
	const positions = await fetchUserLpPositions(did);
	if (positions.length === 0) return [];

	const poolByContract = new Map(pools.map((p) => [p.contractId, p]));

	const out: MyPoolRow[] = [];
	for (const pos of positions) {
		const pool = poolByContract.get(pos.contractId);
		if (!pool) continue; // user holds LP for a pool not currently in the loaded list
		const share = pool.totalLpRaw > 0 ? pos.lpBalance / pool.totalLpRaw : 0;
		const myAmt0 = (pool.reserve0Raw * share) / 10 ** pool.decimals0;
		const myAmt1 = (pool.reserve1Raw * share) / 10 ** pool.decimals1;
		const myUsd = myAmt0 * pool.usdPrice0 + myAmt1 * pool.usdPrice1;
		out.push({
			id: pos.contractId,
			contractId: pos.contractId,
			pair: pool.pair,
			pairSymbols: pool.pairSymbols,
			lpBalance: pos.lpBalance,
			totalLp: pool.totalLpRaw,
			sharePct: share * 100,
			myAmounts: [
				formatNum(myAmt0, pool.pairSymbols[0], pool.decimals0),
				formatNum(myAmt1, pool.pairSymbols[1], pool.decimals1)
			],
			myAmountsRaw: [myAmt0, myAmt1],
			myLiquidityUsd: formatNum(myUsd, '$', 2)
		});
	}
	return out;
}

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
		const [prices, registry] = await Promise.all([getCryptoPrices(), fetchPoolRegistry()]);
		const usdPrices = {
			hive: prices.hive?.usd ?? 0,
			hbd: prices.hive_dollar?.usd ?? 0,
			btc: prices.bitcoin?.usd ?? 0
		};

		if (registry.length === 0) {
			console.warn('Pool registry returned no pools from indexer');
			return [];
		}

		const poolRows = await Promise.all(
			registry.map((entry) =>
				fetchSinglePool(entry.contractId, entry.symbols, range, usdPrices)
			)
		);

		return poolRows;
	} catch (err) {
		console.error('Failed to fetch pool state', err);
		return [];
	}
}
