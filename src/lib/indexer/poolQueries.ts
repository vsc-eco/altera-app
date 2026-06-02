import { type AggregateResult, hasuraQuery } from './query';

export type TimeRange = '1d' | '7d' | '30d' | 'max';

export function getTimeGte(range: TimeRange): string | null {
	if (range === 'max') return null;
	const now = new Date();
	const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
	now.setDate(now.getDate() - days);
	return now.toISOString();
}

/**
 * Per-asset trading volume for a pool over a time window. We split the swap
 * events by direction (`asset_in`) so we can attribute each leg's smallest
 * units to the *right* asset — the old implementation summed amount_in /
 * amount_out blindly and treated them as fixed (sym0, sym1), which mixed HBD
 * smallest units with HIVE smallest units for any HIVE→HBD swap and inflated
 * the USD figure ~9× for the HIVE-HBD pool.
 *
 * `symbols` is the pool's two asset symbols in lowercase
 * (e.g. `['hbd', 'hive']`). Returns the total smallest-units of each asset
 * that moved through the pool across BOTH directions:
 *
 *   touched[sym0] = (amount_in where asset_in=sym0) + (amount_out where asset_in=sym1)
 *   touched[sym1] = (amount_in where asset_in=sym1) + (amount_out where asset_in=sym0)
 *
 * Caller (`poolsData.ts`) values each side at its own asset's USD price and
 * picks the volume convention (HBD-anchored when present, else avg of sides).
 */
export async function fetchPoolVolume(
	poolId: string,
	range: TimeRange,
	symbols: [string, string]
): Promise<{ count: number; touched: Record<string, number> }> {
	const [sym0, sym1] = symbols;
	const gte = getTimeGte(range);
	const tsClause = gte ? `, indexer_ts: {_gte: "${gte}"}` : '';

	const query = `
		query PoolVolume($pool: String!) {
			dir0: dex_pool_swap_events_aggregate(where: {indexer_contract_id: {_eq: $pool}${tsClause}, asset_in: {_eq: "${sym0}"}}) {
				aggregate { count sum { amount_in amount_out } }
			}
			dir1: dex_pool_swap_events_aggregate(where: {indexer_contract_id: {_eq: $pool}${tsClause}, asset_in: {_eq: "${sym1}"}}) {
				aggregate { count sum { amount_in amount_out } }
			}
		}
	`;
	const data = await hasuraQuery(query, { pool: poolId });
	const dir0 = (data?.dir0 as AggregateResult)?.aggregate;
	const dir1 = (data?.dir1 as AggregateResult)?.aggregate;

	// In each "dir<n>" bucket, asset_in === sym<n> so:
	//   amount_in  belongs to sym<n>
	//   amount_out belongs to the OTHER asset
	const dir0In = dir0?.sum?.amount_in ?? 0;
	const dir0Out = dir0?.sum?.amount_out ?? 0;
	const dir1In = dir1?.sum?.amount_in ?? 0;
	const dir1Out = dir1?.sum?.amount_out ?? 0;

	return {
		count: (dir0?.count ?? 0) + (dir1?.count ?? 0),
		touched: {
			[sym0]: dir0In + dir1Out,
			[sym1]: dir1In + dir0Out
		}
	};
}

export type PoolAssetFee = { asset: string; magiFee: number; lpFee: number };

/**
 * Per-asset fee breakdown for a pool, over the selected time window.
 *
 * A pool collects fees in BOTH of its assets — one per swap direction — so the
 * old approach (summing into a single number and pricing it as one asset)
 * inflated the figure several-fold (HIVE fees counted as HBD). We aggregate the
 * raw `dex_pool_fee_events` (which carry `asset` + `indexer_ts`) per asset for
 * the chosen range, so fees stay correct AND track the timeframe like volume;
 * the caller values each asset at its own price.
 *
 * PERF: for wide windows (30d/max) across the whole pool list this pulls a few
 * hundred rows per pool. When the indexer exposes a per-asset rollup that takes
 * a `$since` timestamp (e.g. `fees_by_asset_since(pool, since)`), swap the query
 * below for a single aggregated call — the return shape stays the same.
 */
export async function fetchPoolFees(poolId: string, range: TimeRange): Promise<PoolAssetFee[]> {
	const gte = getTimeGte(range);
	// Exclude rows with no `asset` tag. A 3-day indexer window (2026-04-16..18)
	// emitted fee events with a null asset; they only surface in the `max`
	// range (older than 30d), where they were aggregating under the key
	// "null" and rendering as a bogus "… NULL" currency in the breakdown.
	const whereClause = gte
		? `{indexer_contract_id: {_eq: $pool}, indexer_ts: {_gte: "${gte}"}, asset: {_is_null: false}}`
		: `{indexer_contract_id: {_eq: $pool}, asset: {_is_null: false}}`;

	const query = `
		query PoolFeeEvents($pool: String!) {
			dex_pool_fee_events(where: ${whereClause}) {
				asset lp_fee magi_fee
			}
		}
	`;
	const data = await hasuraQuery(query, { pool: poolId });
	const rows =
		(data?.dex_pool_fee_events as Array<Record<string, number | string>> | undefined) ?? [];

	const byAsset = new Map<string, PoolAssetFee>();
	for (const r of rows) {
		// Defensive: skip any untagged row that slips past the query filter so
		// it can't create a "null"/"NULL" asset bucket.
		if (r.asset == null) continue;
		const asset = String(r.asset);
		const entry = byAsset.get(asset) ?? { asset, lpFee: 0, magiFee: 0 };
		entry.lpFee += Number(r.lp_fee) || 0;
		entry.magiFee += Number(r.magi_fee) || 0;
		byAsset.set(asset, entry);
	}
	return [...byAsset.values()];
}

/**
 * Indexer-only snapshot lookup for a single pool. Returns the latest
 * `dex_pool_liquidity` row (reserve0/reserve1/total_lp) without any
 * event-aggregation, for callers that don't need volume/fees (e.g.
 * swapCalc when chain-state reads are unavailable on testnet).
 */
export async function fetchPoolLiquiditySnapshot(
	poolId: string
): Promise<{ reserve0: number; reserve1: number; totalLp: number } | null> {
	if (!poolId) return null;
	const query = `
		query PoolLiquiditySnapshot($pool: String!) {
			dex_pool_liquidity(where: {pool_contract: {_eq: $pool}}, limit: 1) {
				reserve0
				reserve1
				total_lp
			}
		}
	`;
	try {
		const data = await hasuraQuery(query, { pool: poolId });
		const snap = (data?.dex_pool_liquidity as
			| Array<{ reserve0: number | string; reserve1: number | string; total_lp: number | string }>
			| undefined)?.[0];
		if (!snap) return null;
		return {
			reserve0: Number(snap.reserve0) || 0,
			reserve1: Number(snap.reserve1) || 0,
			totalLp: Number(snap.total_lp) || 0
		};
	} catch (err) {
		console.error('fetchPoolLiquiditySnapshot failed', err);
		return null;
	}
}

export async function fetchPoolLiquidity(poolId: string): Promise<{
	netAmount0: number;
	netAmount1: number;
	netLp: number;
	snapshot: { reserve0: number; reserve1: number; totalLp: number } | null;
}> {
	const query = `
		query PoolLiquidity($pool: String!) {
			adds: dex_pool_add_liq_events_aggregate(where: {indexer_contract_id: {_eq: $pool}}) {
				aggregate { sum { amount0 amount1 lp_minted } }
			}
			removes: dex_pool_rem_liq_events_aggregate(where: {indexer_contract_id: {_eq: $pool}}) {
				aggregate { sum { amount0 amount1 lp_burned } }
			}
			dex_pool_liquidity(where: {pool_contract: {_eq: $pool}}, limit: 1) {
				reserve0
				reserve1
				total_lp
			}
		}
	`;
	const data = await hasuraQuery(query, { pool: poolId });
	const adds = (data?.adds as AggregateResult)?.aggregate?.sum;
	const removes = (data?.removes as AggregateResult)?.aggregate?.sum;
	const snap = (data?.dex_pool_liquidity as
		| Array<{ reserve0: number | string; reserve1: number | string; total_lp: number | string }>
		| undefined)?.[0];
	return {
		netAmount0: (adds?.amount0 ?? 0) - (removes?.amount0 ?? 0),
		netAmount1: (adds?.amount1 ?? 0) - (removes?.amount1 ?? 0),
		netLp: (adds?.lp_minted ?? 0) - (removes?.lp_burned ?? 0),
		snapshot: snap
			? {
					reserve0: Number(snap.reserve0) || 0,
					reserve1: Number(snap.reserve1) || 0,
					totalLp: Number(snap.total_lp) || 0
				}
			: null
	};
}

export type PoolRegistryEntry = {
	contractId: string;
	symbols: [string, string];
	feeBps: number | null;
};

function parseRegistryAssetSymbol(raw: unknown, fallback: string): string {
	if (raw == null) return fallback;
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (trimmed.startsWith('{')) {
			try {
				const obj = JSON.parse(trimmed);
				if (obj?.asset) return String(obj.asset).toUpperCase();
			} catch {
				/* fall through */
			}
		}
		return trimmed.toUpperCase();
	}
	if (typeof raw === 'object' && raw && 'asset' in (raw as Record<string, unknown>)) {
		const v = (raw as Record<string, unknown>).asset;
		if (v) return String(v).toUpperCase();
	}
	return fallback;
}

/** Query the indexer for every registered DEX pool. */
export async function fetchPoolRegistry(): Promise<PoolRegistryEntry[]> {
	const query = `
		query PoolRegistry {
			dex_pool_registry {
				pool_contract
				asset0
				asset1
				fee_bps
			}
		}
	`;
	const data = await hasuraQuery(query, {});
	const rows = (data?.dex_pool_registry ?? []) as Array<{
		pool_contract: string;
		asset0: unknown;
		asset1: unknown;
		fee_bps: number | null;
	}>;
	return rows.map((row) => ({
		contractId: row.pool_contract,
		symbols: [
			parseRegistryAssetSymbol(row.asset0, '?'),
			parseRegistryAssetSymbol(row.asset1, '?')
		],
		feeBps: row.fee_bps ?? null
	}));
}

export type UserLpPosition = {
	contractId: string;
	provider: string;
	lpBalance: number;
};

/** LP positions for a given VSC account (DID). Excludes zero/negative balances. */
export async function fetchUserLpPositions(did: string): Promise<UserLpPosition[]> {
	if (!did) return [];
	const query = `
		query UserLpPositions($provider: String!) {
			dex_pool_lp_positions(
				where: { provider: { _eq: $provider }, lp_balance: { _gt: "0" } }
			) {
				pool_contract
				provider
				lp_balance
			}
		}
	`;
	const data = await hasuraQuery(query, { provider: did });
	const rows = (data?.dex_pool_lp_positions ?? []) as Array<{
		pool_contract: string;
		provider: string;
		lp_balance: number | string;
	}>;
	return rows.map((row) => ({
		contractId: row.pool_contract,
		provider: row.provider,
		lpBalance: Number(row.lp_balance) || 0
	}));
}
