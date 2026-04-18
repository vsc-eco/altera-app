import type { PoolDepths } from '@magi/core';

export interface PoolProvider {
	getPoolDepths(assetA: string, assetB: string): Promise<PoolDepths | null>;
}

const HASURA_PATH = '/v1/graphql';

export function createDefaultPoolProvider(_gqlUrl?: string, indexerUrl?: string): PoolProvider {
	let cache: { entries: PoolDepths[]; ts: number } | null = null;
	const CACHE_TTL = 5_000;

	return {
		async getPoolDepths(assetA, assetB) {
			const now = Date.now();
			if (!cache || now - cache.ts > CACHE_TTL) {
				const entries = indexerUrl
					? await fetchPoolsFromIndexer(indexerUrl)
					: [];
				cache = entries.length > 0 ? { entries, ts: now } : cache;
			}
			if (!cache || cache.entries.length === 0) return null;

			const a = assetA.toLowerCase();
			const b = assetB.toLowerCase();
			return cache.entries.find((p) =>
				(p.asset0 === a && p.asset1 === b) || (p.asset0 === b && p.asset1 === a)
			) ?? null;
		}
	};
}

async function fetchPoolsFromIndexer(indexerUrl: string): Promise<PoolDepths[]> {
	const url = indexerUrl.replace(/\/+$/, '') + HASURA_PATH;
	const query = `{
		dex_pool_registry { pool_contract asset0 asset1 }
		dex_pool_liquidity { pool_contract reserve0 reserve1 }
	}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query })
	});
	if (!res.ok) return [];
	const body = await res.json();
	const registry = body?.data?.dex_pool_registry ?? [];
	const liquidity = body?.data?.dex_pool_liquidity ?? [];

	const liqMap = new Map<string, { reserve0: number; reserve1: number }>();
	for (const l of liquidity) {
		if (l.pool_contract && l.reserve0 != null && l.reserve1 != null) {
			liqMap.set(l.pool_contract, { reserve0: l.reserve0, reserve1: l.reserve1 });
		}
	}

	const results: PoolDepths[] = [];
	for (const r of registry) {
		const liq = liqMap.get(r.pool_contract);
		if (!liq) continue;
		results.push({
			contractId: r.pool_contract,
			asset0: String(r.asset0).toLowerCase(),
			asset1: String(r.asset1).toLowerCase(),
			reserve0: BigInt(liq.reserve0),
			reserve1: BigInt(liq.reserve1)
		});
	}
	return results;
}
