import { parseTs } from './btcBalanceHistory';
import { fetchAllEventRows } from './query';

/** Cumulative LP-fee revenue one account has accrued in one pool. */
export type PoolRevenueSeries = {
	contractId: string;
	/** "HBD:HIVE" — the pool's display pair. */
	pair: string;
	/** All-time accrued revenue in USD as of each sampled date. */
	cumulativeUsd: number[];
	/** All-time accrued revenue per asset, in native display units. */
	byAsset: Record<string, number>;
	/** Native per-asset totals as of each sampled date, for the table view. */
	byAssetAt: Record<string, number[]>;
};

export type PoolRevenueHistory = {
	pools: PoolRevenueSeries[];
	/** True when pre-pendulum fee rows (no asset recorded) were skipped — the
	 *  same rows the Pools table drops, so both figures agree. */
	skippedLegacyRows: boolean;
};

/** What `fetchUserPoolRevenue` needs to know about a pool: its two assets'
 *  decimals and USD prices. `PoolRow` from `$lib/pools/poolsData` satisfies it. */
export type PoolPricing = {
	contractId: string;
	pair: string;
	pairSymbols: [string, string];
	decimals0: number;
	decimals1: number;
	usdPrice0: number;
	usdPrice1: number;
};

type LpEvent = { ts: Date; provider: string; delta: number };
type FeeEvent = { ts: Date; asset: string | null; lpFee: number };

/**
 * When this account first deposited into each pool it has ever provided
 * liquidity to, keyed by pool contract id (raw indexer timestamp strings, so
 * they can be compared and reused as a `_gte` filter without a round trip).
 *
 * Everything downstream hangs off this: a pool the account never entered needs
 * no fee events fetched at all, and fees charged before its first deposit were
 * earned at a 0% share, so they cannot contribute either.
 */
export async function fetchUserPoolStarts(did: string): Promise<Map<string, string>> {
	const firstAddByPool = new Map<string, string>();
	if (!did) return firstAddByPool;
	const myAdds = await fetchAllEventRows<{ indexer_ts: string; indexer_contract_id: string }>(
		'dex_pool_add_liq_events',
		'indexer_ts indexer_contract_id',
		{ provider: { _eq: did } }
	);
	for (const row of myAdds) {
		const prev = firstAddByPool.get(row.indexer_contract_id);
		if (prev === undefined || row.indexer_ts < prev) {
			firstAddByPool.set(row.indexer_contract_id, row.indexer_ts);
		}
	}
	return firstAddByPool;
}

/**
 * Per-pool cumulative LP-fee revenue for one account.
 *
 * The Magi DEX keeps LP fees in the pool reserve (dex contract: "fees stay in
 * pool implicitly") — there is no claim event and no per-provider fee table to
 * read, so revenue has to be attributed. For every fee event the pool emitted
 * while the account held LP:
 *
 *     accountRevenue += lp_fee × (accountLp / totalLp) at that instant
 *
 * Both LP figures are replayed from `dex_pool_add_liq_events` /
 * `dex_pool_rem_liq_events`, which is the same derivation the indexer's own
 * `dex_pool_lp_positions` and `dex_pool_liquidity` views use. Verified
 * 2026-11-13 on mainnet: the replayed `totalLp` matches
 * `dex_pool_liquidity.total_lp` exactly for all three live pools.
 *
 * The series is a BALANCE, not a per-period figure: it counts every fee the
 * account ever accrued, including before `dates[0]`, so the date range only
 * zooms and the curve never drops unless the account's share goes to zero.
 *
 * Fees are valued at current prices (no historical feed reaches back far
 * enough), so the USD curve tracks fees accruing, not the market.
 */
export async function fetchUserPoolRevenue(
	did: string,
	pools: PoolPricing[],
	dates: Date[]
): Promise<PoolRevenueHistory> {
	if (!did || pools.length === 0 || dates.length === 0) {
		return { pools: [], skippedLegacyRows: false };
	}

	const firstAddByPool = await fetchUserPoolStarts(did);
	if (firstAddByPool.size === 0) return { pools: [], skippedLegacyRows: false };

	const mine = pools.filter((p) => firstAddByPool.has(p.contractId));
	let skippedLegacyRows = false;

	const series = await Promise.all(
		mine.map(async (pool) => {
			const contract = { _eq: pool.contractId };
			const firstAdd = firstAddByPool.get(pool.contractId)!;

			const [adds, rems, fees] = await Promise.all([
				fetchAllEventRows<{ indexer_ts: string; provider: string; lp_minted: number | string }>(
					'dex_pool_add_liq_events',
					'indexer_ts provider lp_minted',
					{ indexer_contract_id: contract }
				),
				fetchAllEventRows<{ indexer_ts: string; provider: string; lp_burned: number | string }>(
					'dex_pool_rem_liq_events',
					'indexer_ts provider lp_burned',
					{ indexer_contract_id: contract }
				),
				// Fees before the account's first deposit are earned at a 0%
				// share, so they cannot contribute and are not fetched.
				fetchAllEventRows<{ indexer_ts: string; asset: string | null; lp_fee: number | string }>(
					'dex_pool_fee_events',
					'indexer_ts asset lp_fee',
					{ indexer_contract_id: contract, indexer_ts: { _gte: firstAdd } }
				)
			]);

			const lpEvents: LpEvent[] = [
				...adds.map((r) => ({
					ts: parseTs(r.indexer_ts),
					provider: r.provider,
					delta: num(r.lp_minted)
				})),
				...rems.map((r) => ({
					ts: parseTs(r.indexer_ts),
					provider: r.provider,
					delta: -num(r.lp_burned)
				}))
			].sort((a, b) => a.ts.getTime() - b.ts.getTime());

			const feeEvents: FeeEvent[] = fees
				.map((r) => ({ ts: parseTs(r.indexer_ts), asset: r.asset, lpFee: num(r.lp_fee) }))
				.sort((a, b) => a.ts.getTime() - b.ts.getTime());

			const priced = assetPricing(pool);
			const accrued: Record<string, number> = {};
			const byAssetAt: Record<string, number[]> = {};
			const cumulativeUsd = new Array<number>(dates.length).fill(0);

			let totalLp = 0;
			let myLp = 0;
			let lpIdx = 0;
			let feeIdx = 0;

			const applyLpUpTo = (cutoff: number) => {
				while (lpIdx < lpEvents.length && lpEvents[lpIdx].ts.getTime() <= cutoff) {
					const ev = lpEvents[lpIdx++];
					totalLp += ev.delta;
					if (ev.provider === did) myLp += ev.delta;
				}
			};

			for (let d = 0; d < dates.length; d++) {
				const cutoff = dates[d].getTime();
				while (feeIdx < feeEvents.length && feeEvents[feeIdx].ts.getTime() <= cutoff) {
					const fee = feeEvents[feeIdx++];
					// Replay LP movements up to this fee's instant so the share
					// is the one that actually applied when it was charged.
					applyLpUpTo(fee.ts.getTime());
					if (fee.asset == null) {
						// Pre-pendulum rows record no asset; the Pools table drops
						// them too, so dropping them here keeps the two agreeing.
						if (fee.lpFee > 0) skippedLegacyRows = true;
						continue;
					}
					if (totalLp <= 0 || myLp <= 0 || fee.lpFee <= 0) continue;
					const share = myLp / totalLp;
					const asset = fee.asset.toLowerCase();
					const scale = priced[asset]?.decimals ?? 3;
					accrued[asset] = (accrued[asset] ?? 0) + (fee.lpFee * share) / 10 ** scale;
				}
				applyLpUpTo(cutoff);

				let usd = 0;
				for (const [asset, amount] of Object.entries(accrued)) {
					usd += amount * (priced[asset]?.usd ?? 0);
					(byAssetAt[asset] ??= new Array<number>(dates.length).fill(0))[d] = amount;
				}
				cumulativeUsd[d] = usd;
			}

			// Assets first seen late still need their earlier (zero) slots filled.
			for (const amounts of Object.values(byAssetAt)) {
				for (let d = 0; d < dates.length; d++) amounts[d] ??= 0;
			}

			return {
				contractId: pool.contractId,
				pair: pool.pair,
				cumulativeUsd,
				byAsset: accrued,
				byAssetAt
			} satisfies PoolRevenueSeries;
		})
	);

	// Biggest earner first, so the stack order is stable and readable.
	series.sort((a, b) => last(b.cumulativeUsd) - last(a.cumulativeUsd));
	return { pools: series, skippedLegacyRows };
}

function assetPricing(pool: PoolPricing): Record<string, { decimals: number; usd: number }> {
	return {
		[pool.pairSymbols[0].toLowerCase()]: { decimals: pool.decimals0, usd: pool.usdPrice0 },
		[pool.pairSymbols[1].toLowerCase()]: { decimals: pool.decimals1, usd: pool.usdPrice1 }
	};
}

function last(xs: number[]): number {
	return xs.length > 0 ? xs[xs.length - 1] : 0;
}

function num(v: number | string | null | undefined): number {
	const n = typeof v === 'string' ? Number(v) : (v ?? 0);
	return Number.isFinite(n) ? n : 0;
}
