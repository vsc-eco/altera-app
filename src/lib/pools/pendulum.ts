/**
 * Node-vs-LP fee split — the "pendulum" distribution.
 *
 * Ported bit-for-bit from go-vsc-node `modules/incentive-pendulum` (the source
 * of truth). We mirror the integer/base-unit math exactly (BigInt here ==
 * `big.Int` there; BigInt `/` truncates toward zero == `big.Int.Quo` == floor
 * for the non-negative money path) so what Altera previews matches what the node
 * settles. Reference test vectors live in `pendulum.test.ts`.
 *
 * Scope: this file is the fee SPLIT (how the distributable pot divides between
 * node runners and LPs) + the collateral zone. The per-swap fee scaling
 * (stabilizer multiplier) is a separate concern already handled by the swap
 * guard in `swapCalc.ts`.
 *
 * The formulas + all constants are deployed and stable. The one thing the
 * frontend cannot derive is the live network aggregates that feed the split
 * (R, T, V, P, effective bond) — those come from the node via GraphQL; see
 * `PendulumAggregates` / `previewSplit` below. Until that endpoint exists this
 * module computes correctly from whatever inputs it's handed (stub or real).
 *
 * Source refs (go-vsc-node):
 *   modules/incentive-pendulum/pendulum_int.go        → SplitInt
 *   modules/incentive-pendulum/settlement/calculator.go → CalculateSplitPreviewFixed
 *   modules/incentive-pendulum/params.go              → CliffSBps, band thresholds
 *   lib/intmath/muldiv.go                             → MulDivFloor
 */

/** Basis-point denominator. 1.0 == 10_000 bps. */
export const BPS_SCALE = 10_000n;

/** Per-swap protocol fee rate: 8 bps = 0.08% of gross output. */
export const PROTOCOL_FEE_RATE_BPS = 8n;

/** Equilibrium collateralization ratio s_eq = V/E, in bps (1.0). At s_eq the
 *  node and LP yields are equal. */
export const TARGET_S_BPS = 10_000n;

/** floor(a·b/c). BigInt division truncates toward zero, which equals floor for
 *  the non-negative pendulum money path. Throws on c == 0 (matches the Go panic). */
export function mulDivFloor(a: bigint, b: bigint, c: bigint): bigint {
	if (c === 0n) throw new Error('mulDivFloor: divide by zero');
	return (a * b) / c;
}

/** c = 2·s_eq² + s_eq (w = ½ is structural, from V = 2P). In bps: 2·S²/B + S.
 *  At s_eq = 1.0 this is c = 3.0 → cliff at V ≥ 3E. */
function deriveCliffSBps(targetSBps: bigint): bigint {
	return (2n * targetSBps * targetSBps) / BPS_SCALE + targetSBps;
}

/** Hard-cliff ratio c (bps). At or above s = c the vault is under-secured and
 *  100% of the pot routes to nodes (LP share 0). */
export const CLIFF_S_BPS = deriveCliffSBps(TARGET_S_BPS);

/** c·E in HBD base units (floor) — the threshold V is compared against.
 *  V ≥ cliffTimesE(E) ⇒ under-secured. */
export function cliffTimesE(E: bigint): bigint {
	return mulDivFloor(E, CLIFF_S_BPS, BPS_SCALE);
}

// ── The split ───────────────────────────────────────────────────────────────

/** Integer/base-unit inputs to the split. All non-negative; E,T strictly > 0. */
export interface SplitInputs {
	/** R — distributable CLP fees this epoch. */
	R: bigint;
	/** E — effective security bond. */
	E: bigint;
	/** T — total effective bond. */
	T: bigint;
	/** V — vault liquidity (≈ 2·Σ pool HBD-side depth). */
	V: bigint;
	/** P — pooled HBD liquidity (Σ pool HBD-side depth). */
	P: bigint;
}

export interface SplitOutputs {
	finalNodeShare: bigint;
	finalPoolShare: bigint;
	/** s ≥ c (V ≥ c·E) — vault under-secured, everything routed to nodes. */
	underSecured: boolean;
	/** false on invalid inputs (negative, or E/T ≤ 0). */
	ok: boolean;
}

const INVALID: SplitOutputs = {
	finalNodeShare: 0n,
	finalPoolShare: 0n,
	underSecured: false,
	ok: false
};

/**
 * Raw (un-floored) reference split — mirror of go-vsc-node `SplitInt`.
 *
 *   denom          = T·V² + P·E·(c·E − V)
 *   finalPoolShare = floor( R · P·E·(c·E − V) / denom )
 *   finalNodeShare = R − finalPoolShare        (residual lands on the node side)
 *
 * V == 0 or V ≥ c·E both fall back to 100% nodes.
 */
export function splitInt({ R, E, T, V, P }: SplitInputs): SplitOutputs {
	if (E <= 0n || T <= 0n) return INVALID;
	if (R < 0n || V < 0n || P < 0n) return INVALID;

	const cE = cliffTimesE(E);

	// Hard cliff: V ≥ c·E (under-secured) — and the degenerate V == 0 vault.
	if (V >= cE) {
		return { finalNodeShare: R, finalPoolShare: 0n, underSecured: true, ok: true };
	}
	if (V === 0n) {
		return { finalNodeShare: R, finalPoolShare: 0n, underSecured: false, ok: true };
	}

	const tvSquared = T * V * V; // T·V²
	const cEMinusV = cE - V; // c·E − V > 0
	const peTerm = P * E * cEMinusV; // P·E·(c·E−V) ≥ 0
	const denom = tvSquared + peTerm;

	if (denom === 0n) {
		// Defensive — unreachable with T,V > 0. Route to nodes.
		return { finalNodeShare: R, finalPoolShare: 0n, underSecured: false, ok: true };
	}

	const poolShare = mulDivFloor(R, peTerm, denom);
	const nodeShare = R - poolShare;
	return { finalNodeShare: nodeShare, finalPoolShare: poolShare, underSecured: false, ok: true };
}

/** Result of the settlement split preview (mirror of Go `SplitPreview`). */
export interface SplitPreview {
	R: bigint;
	T: bigint;
	E: bigint;
	V: bigint;
	P: bigint;
	finalNodeShare: bigint;
	finalPoolShare: bigint;
	/** Node share as a fraction of R, in bps (for display). null when R ≤ 0. */
	nodeShareBps: number | null;
	underSecured: boolean;
	ok: boolean;
}

/**
 * Mirror of go-vsc-node `settlement.CalculateSplitPreviewFixed`. Derives the
 * effective security bond E = T·(effNum/effDen), runs `splitInt`, and clamps the
 * node share to [0, R] with the pool taking the remainder.
 */
export function calculateSplitPreviewFixed(
	R: bigint,
	T: bigint,
	effNum: bigint,
	effDen: bigint,
	V: bigint,
	P: bigint
): SplitPreview {
	const base = {
		R,
		T,
		E: 0n,
		V,
		P,
		finalNodeShare: 0n,
		finalPoolShare: 0n,
		nodeShareBps: null,
		ok: false
	} as SplitPreview;
	if (R <= 0n || T <= 0n || effNum <= 0n || effDen <= 0n) return { ...base, underSecured: false };

	const E = (T * effNum) / effDen;
	if (E <= 0n) return { ...base, underSecured: false };

	const split = splitInt({ R, E, T, V, P });
	if (!split.ok) return { ...base, E, underSecured: false };

	let node = split.finalNodeShare;
	if (node < 0n) node = 0n;
	if (node > R) node = R;
	const pool = R - node;

	return {
		R,
		T,
		E,
		V,
		P,
		finalNodeShare: node,
		finalPoolShare: pool,
		nodeShareBps: R > 0n ? Number((node * BPS_SCALE) / R) : null,
		underSecured: split.underSecured,
		ok: true
	};
}

// ── Collateral zone (V/E) ─────────────────────────────────────────────────────

/** floor integer square root of a non-negative BigInt (Newton's method). */
function bigintSqrt(n: bigint): bigint {
	if (n < 0n) throw new Error('bigintSqrt: negative');
	if (n < 2n) return n;
	let x = n;
	let y = (x + 1n) / 2n;
	while (y < x) {
		x = y;
		y = (x + n / x) / 2n;
	}
	return x;
}

/** Invert the yield-ratio curve ρ(s) = 2s²/(c−s) → s (bps) where ρ = ratioBps:
 *  s = (−ρ + √(ρ² + 8·ρ·c)) / 4. Mirror of Go `sEdgeForRatio`. */
function sEdgeForRatio(ratioBps: bigint, cliffSBps: bigint): bigint {
	const disc = ratioBps * ratioBps + 8n * ratioBps * cliffSBps;
	return (bigintSqrt(disc) - ratioBps) / 4n;
}

// Deployed yield-ratio band thresholds ρ = 2s²/(c−s) at each zone edge (bps),
// straight from params.go. The zones are level sets of the ratio curve.
const idealRatioLo = 7_364n;
const idealRatioHi = 13_444n;
const safeRatioLo = 2_571n;
const safeRatioHi = 32_667n;
const warnRatioLo = 1_667n;
const warnRatioHi = 45_000n;
const extremeRatioLo = 1_000n;
const extremeRatioHi = 100_000n;

/** Collateral-band s-edges (bps), derived by inverting the ratio curve. */
export const BAND_EDGES = {
	idealLo: sEdgeForRatio(idealRatioLo, CLIFF_S_BPS),
	idealHi: sEdgeForRatio(idealRatioHi, CLIFF_S_BPS),
	safeLo: sEdgeForRatio(safeRatioLo, CLIFF_S_BPS),
	safeHi: sEdgeForRatio(safeRatioHi, CLIFF_S_BPS),
	warnLo: sEdgeForRatio(warnRatioLo, CLIFF_S_BPS),
	warnHi: sEdgeForRatio(warnRatioHi, CLIFF_S_BPS),
	extremeLo: sEdgeForRatio(extremeRatioLo, CLIFF_S_BPS),
	extremeHi: sEdgeForRatio(extremeRatioHi, CLIFF_S_BPS)
} as const;

export type CollateralZone = 'ideal' | 'safe' | 'warn' | 'extreme' | 'critical' | 'under-secured';

/** Current collateralization s = V/E in bps. */
export function sBps(V: bigint, E: bigint): bigint {
	if (E <= 0n) return 0n;
	return mulDivFloor(V, BPS_SCALE, E);
}

/** Classify s (bps) into its tightest containing band. Derived from the same
 *  edges the node uses. `under-secured` at/above the cliff. */
export function classifyZone(s: bigint): CollateralZone {
	if (s >= CLIFF_S_BPS) return 'under-secured';
	const e = BAND_EDGES;
	if (s >= e.idealLo && s <= e.idealHi) return 'ideal';
	if (s >= e.safeLo && s <= e.safeHi) return 'safe';
	if (s >= e.warnLo && s <= e.warnHi) return 'warn';
	if (s >= e.extremeLo && s <= e.extremeHi) return 'extreme';
	return 'critical';
}

// ── Live inputs (from the node via GraphQL — not yet exposed) ──────────────────

/**
 * The network aggregates the split needs, which the frontend can't derive.
 * Milo is exposing these via GraphQL (as of 2026-07-02, pending). Wire the real
 * query here once the fields land; everything above already consumes this shape.
 *
 * TODO(pools-rework): replace the stub with the real query.
 *   R — distributable node/fee bucket (pendulum:nodes)
 *   T — total consensus stake (total effective bond)
 *   V — total vault liquidity
 *   P — pooled HBD liquidity (Σ pool HBD-side depth)
 *   effBondNum / effBondDen — effective-bond ratio (E = T·num/den)
 */
export interface PendulumAggregates {
	R: bigint;
	T: bigint;
	V: bigint;
	P: bigint;
	effBondNum: bigint;
	effBondDen: bigint;
}

/** Convenience: run the preview + zone directly from the live aggregates. */
export function previewSplit(agg: PendulumAggregates): SplitPreview & { zone: CollateralZone } {
	const preview = calculateSplitPreviewFixed(
		agg.R,
		agg.T,
		agg.effBondNum,
		agg.effBondDen,
		agg.V,
		agg.P
	);
	return { ...preview, zone: classifyZone(sBps(agg.V, preview.E)) };
}
