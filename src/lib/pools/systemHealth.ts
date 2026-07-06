import type { TimeRange, PendulumStat } from '$lib/indexer/poolQueries';
import { fetchPendulumStats, fetchMaxWindowDays } from '$lib/indexer/poolQueries';
import type { PoolRow } from './poolsData';
import { fetchPools } from './poolsData';
import { classifyZone, splitFromSBps, type CollateralZone } from './pendulum';

/**
 * Protocol consensus constants (NOT indexer data — baked into the fee model):
 * node collateral T = 1.5 × V / s, and total liquidity V = 2 × the HBD-side
 * reserve. Per tibfox, 2026-06-17.
 */
export const TE_RATIO = 1.5;
export const V_HBD_MULTIPLIER = 2;

/**
 * Illustrative safe band for `s` around the 1.0 equilibrium. The real edges
 * aren't published yet — the split is near-binary (pinned to nodes outside the
 * band, ~60/40 inside), so these bounds are placeholders for the UI's green
 * zone until lordbutterfly/tibfox give exact values. Equilibrium is s = 1.0.
 */
export const S_BALANCE = 1.0;
export const S_SAFE_BAND: [number, number] = [0.9, 1.2];

export type PoolApr = {
	id: string;
	pair: string;
	/** LP yield = annualized lp_fees ÷ pool TVL, in %. null when not annualizable. */
	lpAprPct: number | null;
};

export type SystemHealth = {
	/** s = V/E. >1 tilts to nodes, <1 to LPs, 1.0 balanced. null if view absent. */
	s: number | null;
	sBandLo: number;
	sBandHi: number;
	tilt: 'nodes' | 'lps' | 'balanced' | 'unknown';
	/** Realized fee split, system-wide, from node_fees vs lp_fees (USD). */
	nodeSharePct: number | null;
	lpSharePct: number | null;
	/** MODEL split from the live `s` via the ported pendulum math (node = 3s/(2s+3)).
	 *  This is the *current* split the contract would apply — vs the realized
	 *  (historical) split above. null when `s` is unavailable. */
	modelNodeSharePct: number | null;
	modelLpSharePct: number | null;
	/** Collateral zone from the ported band edges (ideal/safe/warn/extreme/…) —
	 *  the real thresholds, replacing the placeholder [0.9, 1.2] band. */
	zone: CollateralZone | null;
	/** Total liquidity V (USD) = 2 × HBD-side reserves. */
	vUsd: number;
	/** Node collateral T (USD) = 1.5 × V / s — the node-APR denominator. */
	collateralUsd: number | null;
	/** One system-wide node APR (%), node collateral backs the whole vault. */
	nodeAprPct: number | null;
	pools: PoolApr[];
	/** false only when a window can't be annualized (e.g. 'max' with no swaps yet). */
	annualized: boolean;
	/** Length of the fee window in days — 1 / 7 / 30, or the elapsed "since launch"
	 *  span for 'max'. null when unknown (empty 'max'). Drives the panel's label. */
	windowDays: number | null;
};

/**
 * Annualization multiplier for a window, or null when it can't be annualized.
 * 'max' is annualized over its actual elapsed span (`maxDays`) — the true
 * duration of the all-time fee total — rather than treated as un-annualizable.
 */
function annualizationFactor(range: TimeRange, maxDays?: number | null): number | null {
	switch (range) {
		case '1d':
			return 365;
		case '7d':
			return 365 / 7;
		case '30d':
			return 365 / 30;
		case 'max':
			return maxDays && maxDays > 0 ? 365 / maxDays : null;
	}
}

/** USD value of a pool's HBD-side reserve, or 0 if the pool isn't HBD-paired. */
function hbdSideUsd(pool: PoolRow): number {
	const [s0, s1] = pool.pairSymbols.map((s) => s.toUpperCase());
	if (s0 === 'HBD') return (pool.reserve0Raw / 10 ** pool.decimals0) * pool.usdPrice0;
	if (s1 === 'HBD') return (pool.reserve1Raw / 10 ** pool.decimals1) * pool.usdPrice1;
	return 0;
}

/**
 * Derive the system fee-balance picture from already-fetched pool rows + the
 * pendulum geometry. Pure: all the indexer reads happen in the caller.
 *
 * - split: realized `Σ node_fees / Σ(node_fees + lp_fees)` across pools (USD).
 * - s: averaged across pendulum rows (it's a global figure, ≈ equal per pool).
 * - node APR: one number = annualized Σ node_fees ÷ collateral T (= 1.5·V/s).
 * - LP APR: per pool = annualized lp_fees ÷ pool TVL.
 */
export function computeSystemHealth(
	rows: PoolRow[],
	pendulum: PendulumStat[],
	range: TimeRange,
	maxDays?: number | null
): SystemHealth {
	const factor = annualizationFactor(range, maxDays);
	const windowDays =
		range === '1d' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : (maxDays ?? null);

	const sVals = pendulum.map((p) => p.sBps / 10000).filter((s) => s > 0);
	const s = sVals.length ? sVals.reduce((a, b) => a + b, 0) / sVals.length : null;

	// The live s (bps) drives both the collateral zone and the model fee split,
	// via the ported pendulum math — no R/T/V/P from the node needed.
	const sBpsAvg = s != null ? BigInt(Math.round(s * 10000)) : null;
	const zone = sBpsAvg != null ? classifyZone(sBpsAvg) : null;
	const modelSplit = sBpsAvg != null ? splitFromSBps(sBpsAvg) : null;
	const modelNodeSharePct = modelSplit ? Number(modelSplit.nodeShareBps) / 100 : null;
	const modelLpSharePct = modelSplit ? Number(modelSplit.lpShareBps) / 100 : null;

	const nodeRev = rows.reduce((a, r) => a + r.feeNodeUsdNum, 0);
	const lpRev = rows.reduce((a, r) => a + r.feeLpUsdNum, 0);
	const splitTotal = nodeRev + lpRev;
	const nodeSharePct = splitTotal > 0 ? (nodeRev / splitTotal) * 100 : null;
	const lpSharePct = nodeSharePct == null ? null : 100 - nodeSharePct;

	const vUsd = V_HBD_MULTIPLIER * rows.reduce((a, r) => a + hbdSideUsd(r), 0);
	const collateralUsd = s && s > 0 ? (TE_RATIO * vUsd) / s : null;
	const nodeAprPct =
		factor != null && collateralUsd && collateralUsd > 0
			? ((nodeRev * factor) / collateralUsd) * 100
			: null;

	const pools: PoolApr[] = rows.map((r) => ({
		id: r.id,
		pair: r.pair,
		lpAprPct:
			factor != null && r.totalLiquidityUsdNum > 0
				? ((r.feeLpUsdNum * factor) / r.totalLiquidityUsdNum) * 100
				: null
	}));

	const [sBandLo, sBandHi] = S_SAFE_BAND;
	const tilt: SystemHealth['tilt'] =
		s == null ? 'unknown' : s > sBandHi ? 'nodes' : s < sBandLo ? 'lps' : 'balanced';

	return {
		s,
		sBandLo,
		sBandHi,
		tilt,
		nodeSharePct,
		lpSharePct,
		modelNodeSharePct,
		modelLpSharePct,
		zone,
		vUsd,
		collateralUsd,
		nodeAprPct,
		pools,
		annualized: factor != null,
		windowDays
	};
}

/** Fetch pools + pendulum stats and compute the system-health snapshot. For the
 *  'max' window we also fetch the elapsed span so lifetime fees can be annualized. */
export async function fetchSystemHealth(range: TimeRange = '7d'): Promise<SystemHealth> {
	const [rows, pendulum, maxDays] = await Promise.all([
		fetchPools(range),
		fetchPendulumStats(),
		range === 'max' ? fetchMaxWindowDays() : Promise.resolve(null)
	]);
	return computeSystemHealth(rows, pendulum, range, maxDays);
}
