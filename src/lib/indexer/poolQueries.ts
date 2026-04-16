import { type AggregateResult, hasuraQuery } from './query';

export type TimeRange = '1d' | '7d' | '30d' | 'max';

export function getTimeGte(range: TimeRange): string | null {
	if (range === 'max') return null;
	const now = new Date();
	const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
	now.setDate(now.getDate() - days);
	return now.toISOString();
}

export async function fetchPoolVolume(
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

export async function fetchPoolFees(
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
