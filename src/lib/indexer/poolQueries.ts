import { type AggregateResult, hasuraQuery, hasuraQueryRaw } from './query';

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

export type PoolAssetFee = {
	asset: string;
	/** lp_fees — what liquidity providers earn (their yield). */
	lpFee: number;
	/** protocol_fees — the full non-LP cut (= node + network). Kept as the
	 *  canonical "protocol" total; equals nodeFee + networkFee on pendulum rows. */
	magiFee: number;
	/** node_fees — node operators' share. 0 when the indexer hasn't deployed the
	 *  split columns yet, or on legacy rows where the cut sits in protocol_fees. */
	nodeFee: number;
	/** network_fees — the network's share. Same 0-fallback caveat as nodeFee. */
	networkFee: number;
};

/**
 * Pre-aggregated per-(pool, asset) fee views, one per time window. The
 * suffix-less view is all-time ("max"). Using these instead of summing raw
 * `dex_pool_fee_events` client-side fixes two bugs at once:
 *   1. The raw query was capped at Hasura's default 100-row limit, so busy
 *      pools (e.g. 7d on the HIVE pool) under-counted fees.
 *   2. The pendulum fee rewrite (2026-06-02 contract redeploy) leaves
 *      `magi_fee` NULL and splits the protocol fee across new columns, so
 *      summing `magi_fee` counted the bulk of the fee as 0 (~$0.02/7d).
 * The views expose the canonical split (`protocol_fees` + `lp_fees`),
 * aggregated server-side with no row cap, consistent across all three
 * indexers (per tibfox, 2026-06-12).
 */
const FEE_VIEW_BY_RANGE: Record<TimeRange, string> = {
	'1d': 'dex_pool_fees_by_asset_24h',
	'7d': 'dex_pool_fees_by_asset_7d',
	'30d': 'dex_pool_fees_by_asset_30d',
	max: 'dex_pool_fees_by_asset'
};

/**
 * Per-asset fee breakdown for a pool, over the selected time window.
 *
 * A pool collects fees in BOTH of its assets (one per swap direction); the
 * caller values each asset at its own price. Reads the pre-aggregated
 * `dex_pool_fees_by_asset_*` view for the range and maps its columns to our
 * `PoolAssetFee` shape: `protocol_fees → magiFee`, `lp_fees → lpFee`.
 */
export async function fetchPoolFees(poolId: string, range: TimeRange): Promise<PoolAssetFee[]> {
	// View name comes from a fixed internal map (never user input) so
	// interpolating it is safe; the pool id is passed as a variable.
	const view = FEE_VIEW_BY_RANGE[range];
	const fields = (extra: string) => `
		query PoolFeesByAsset($pool: String!) {
			${view}(where: { pool_contract: { _eq: $pool } }) {
				asset
				protocol_fees
				lp_fees${extra}
			}
		}
	`;

	// tibfox added node_fees/network_fees to the by-asset views to expose the
	// Node-vs-Network split (node_fees + network_fees = protocol_fees on
	// pendulum rows; both 0 on legacy rows). The columns are rolling out across
	// indexers, so try the richer query first and fall back to the legacy shape
	// when the configured indexer hasn't deployed them — GraphQL hard-errors on
	// an unknown field, so we detect that and retry rather than silently
	// returning empty fees.
	let { data, errors } = await hasuraQueryRaw(fields('\n\t\t\t\tnode_fees\n\t\t\t\tnetwork_fees'), {
		pool: poolId
	});
	if (errors?.some((e) => /node_fees|network_fees/.test(e.message))) {
		({ data, errors } = await hasuraQueryRaw(fields(''), { pool: poolId }));
	}
	if (errors) console.error('Hasura fee query error:', errors);
	const rows =
		((data as Record<string, unknown> | null)?.[view] as
			| Array<Record<string, number | string>>
			| undefined) ?? [];

	// Views are already one row per asset; the Map keeps it idempotent if
	// that ever changes and drops any null-asset row defensively.
	const byAsset = new Map<string, PoolAssetFee>();
	for (const r of rows) {
		if (r.asset == null) continue;
		const asset = String(r.asset);
		const entry = byAsset.get(asset) ?? { asset, lpFee: 0, magiFee: 0, nodeFee: 0, networkFee: 0 };
		entry.lpFee += Number(r.lp_fees) || 0;
		entry.magiFee += Number(r.protocol_fees) || 0;
		// 0 when the column is absent (legacy indexer) or the row is legacy.
		entry.nodeFee += Number(r.node_fees) || 0;
		entry.networkFee += Number(r.network_fees) || 0;
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
		const snap = (
			data?.dex_pool_liquidity as
				| Array<{ reserve0: number | string; reserve1: number | string; total_lp: number | string }>
				| undefined
		)?.[0];
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
	const snap = (
		data?.dex_pool_liquidity as
			| Array<{ reserve0: number | string; reserve1: number | string; total_lp: number | string }>
			| undefined
	)?.[0];
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
		symbols: [parseRegistryAssetSymbol(row.asset0, '?'), parseRegistryAssetSymbol(row.asset1, '?')],
		feeBps: row.fee_bps ?? null
	}));
}

export type PendulumStat = {
	contractId: string;
	/** s = V/E (liquidity vs node collateral), in basis points. s_bps/10000. */
	sBps: number;
	/** fee-size multiplier in bps (neutral 10000, cap 20000); does NOT move the split. */
	multiplierBps: number;
};

/**
 * Per-pool pendulum geometry from `dex_pool_pendulum_stats`. `last_s_bps` is the
 * global s = V/E that drives the fee split (≈ same on every pool); `s > 10000`
 * (i.e. s > 1.0) means liquidity outweighs node collateral, so the split is
 * pinned toward nodes. Returns [] if the view isn't deployed on the configured
 * indexer (graceful: the health strip just hides the tilt direction).
 */
export async function fetchPendulumStats(): Promise<PendulumStat[]> {
	const query = `
		query PoolPendulumStats {
			dex_pool_pendulum_stats {
				pool_contract
				last_s_bps
				last_multiplier_bps
			}
		}
	`;
	const { data, errors } = await hasuraQueryRaw(query, {});
	if (errors) {
		console.error('Hasura pendulum query error:', errors);
		return [];
	}
	const rows = (data?.dex_pool_pendulum_stats ?? []) as Array<{
		pool_contract: string;
		last_s_bps: number | string;
		last_multiplier_bps: number | string;
	}>;
	return rows.map((r) => ({
		contractId: r.pool_contract,
		sBps: Number(r.last_s_bps) || 0,
		multiplierBps: Number(r.last_multiplier_bps) || 0
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
