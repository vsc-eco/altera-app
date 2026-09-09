/**
 * Swap fee and output calculations using BigInt integer math.
 *
 * All amounts are in smallest units (3 decimal places for HIVE/HBD,
 * i.e. 1.000 HIVE = 1000).
 *
 * Fees are denominated in the OUTPUT asset: the full `x` enters the
 * pool, the constant-product invariant produces a gross output, and
 * fees are carved off that.
 *
 * Formulas:
 *   grossOut          = Y - (X * Y) / (X + x)
 *   base protocol fee = grossOut * feeBps / 10000        (output units, floor 1)
 *   base CLP fee      = (x^2 * Y) / (x + X)^2            (output units, floor 1)
 *
 *   ─── FEE COMPOSITION (post-2026-06-19 contract fix) ───
 *
 *   The on-chain code (`incentive-pendulum/wasm/applier.go`) charges the two
 *   legs differently:
 *     • protocol (8 bps) leg × pendulum stabilizer `m` (m ∈ [1, 2], cap 2.0)
 *     • CLP leg × a CONSTANT scale `CLPScaleBps` (default 625 = 1/16), NO `m`
 *
 *   We don't know the live `m` from the frontend, so we quote the protocol
 *   leg at the worst case (m = 2.0) and the CLP leg at the exact constant:
 *
 *     expectedOutput = grossOut - 2 × baseProtocol - (1/16) × baseCLP
 *     min_amount_out = expectedOutput * (10000 - slippageBps) / 10000
 *
 *   Guarantees: for any real on-chain m ∈ [1, 2], actualOutput ≥ expectedOutput
 *   (the protocol leg is the only `m`-dependent part and we took its worst
 *   case), so the on-chain `actualOutput ≥ min_amount_out` gate passes and the
 *   user is never under-delivered.
 *
 *   HISTORY: before milo's 2026-06-19 fix the stabilizer was ALSO applied to
 *   the CLP leg, so a swap was charged ≈2× its own price impact — large swaps
 *   paid multi-percent fees (the overcharge incident). The fix moved `m` off
 *   the CLP leg and scaled it by the constant instead.
 *
 *   ⚠️ MAINTENANCE TRIPWIRE: `STABILIZER_CAP_BPS` must track the on-chain cap
 *   and `CLP_SCALE_BPS` must track `Config.CLPScaleBps`. If either on-chain
 *   value changes, update the constant below in lockstep. The proper long-term
 *   fix is still a backend `simulateSwap` returning the actual `userOutput`.
 */

/**
 * Hard cap on the pendulum stabilizer multiplier `m` in basis points.
 * 20000 bps = m = 2.0. Mirrors `DefaultStabilizerParamsBps.Cap` in
 * `go-vsc-node/modules/incentive-pendulum/fees_int.go:59-66`. If that
 * file's `Cap` ever changes, change this constant in the same PR.
 */
const STABILIZER_CAP_BPS = 20000n;
const BPS_SCALE = 10000n;

/**
 * Constant scale applied to the CLP fee leg (no stabilizer), in basis points.
 * 625 bps = 1/16. Mirrors `Config.CLPScaleBps` (default 625) in
 * `go-vsc-node/modules/incentive-pendulum/wasm/applier.go`. Added by milo's
 * 2026-06-19 fee fix: the pendulum multiplier was taken OFF the CLP leg and a
 * constant scale put on it instead, so large swaps are no longer charged ≈2×
 * their price impact. If the on-chain default changes, update this in lockstep.
 */
const CLP_SCALE_BPS = 625n;

import { GetStateByKeysStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { fetchPoolRegistry, fetchPoolLiquiditySnapshot } from './poolsData';

/**
 * The pool contract stores reserves as big-endian `big.Int.Bytes()` under
 * short keys `r0` / `r1`. Fetching via `encoding: 'hex'` on
 * `getStateByKeys` returns the raw hex string; an empty/missing key
 * serialises to `""` and means zero.
 */
const KEY_RESERVE_0 = 'r0';
const KEY_RESERVE_1 = 'r1';

/** Decode a hex string returned by the chain-state observer back to
 *  bigint. Accepts missing / empty / `"0x"`-prefixed inputs. */
function hexToBigInt(hex: unknown): bigint | null {
	if (hex == null) return null;
	if (typeof hex !== 'string') return null;
	const h = hex.startsWith('0x') ? hex.slice(2) : hex;
	if (h === '') return 0n;
	if (!/^[0-9a-fA-F]+$/.test(h)) return null;
	return BigInt('0x' + h);
}

export interface PoolDepths {
	reserve0: bigint; // HIVE reserve (smallest units) — legacy, HIVE/HBD only
	reserve1: bigint; // HBD reserve (smallest units) — legacy, HIVE/HBD only
}

/** Pool depths with explicit asset ordering so the same struct can
 *  represent any pair (HIVE/HBD, BTC/HBD, …). `asset0` / `asset1` are
 *  lowercase asset names ("hive", "hbd", "btc"). */
export interface TypedPoolDepths {
	contractId: string;
	asset0: string;
	asset1: string;
	reserve0: bigint;
	reserve1: bigint;
}

export type PoolDepthMap = Record<string, TypedPoolDepths>;

export interface SwapCalcResult {
	baseFee: bigint;
	clpFee: bigint;
	totalFee: bigint;
	expectedOutput: bigint;
	minAmountOut: bigint;
	slippageBps: number; // basis points (e.g. 100 = 1%)
	/** Modelled effective fee as a fraction of gross output, in bps. Drives the
	 *  overcharge safety guard below. For two-hop swaps this sums both hops. */
	feeBps: number;
	/** Set on two-hop swaps. Hop1 takes its fees in the intermediate
	 *  asset (e.g. HBD), separately from the top-level fee fields which
	 *  always represent the final hop in the output asset. */
	hop1Fee?: {
		asset: string;
		baseFee: bigint;
		clpFee: bigint;
		totalFee: bigint;
	};
}

/**
 * Swap-fee safety guard (2026-06-18). The on-chain pendulum CLP fee can charge a
 * swap far above the 8 bps tier — it scales ~2× with the trade's price impact,
 * so large swaps get hit with multi-percent fees (root cause: the CLP leg ×
 * stabilizer in the contract; being fixed by Milo/tibfox). Until that lands, we
 * block any swap whose MODELLED effective fee exceeds this threshold so users
 * can't be silently overcharged. Client-side only — does not stop direct
 * contract callers. Lower/remove once the contract fee is fixed.
 *
 * The contract overcharges ~2× a swap's price impact, so a LOW threshold blocks
 * much normal activity (at 1% it blocks ~$20 HBD→HIVE / ~$15 BTC swaps on
 * current mainnet depth) while a HIGH one only catches the clearly-broken
 * cases. Users already see the post-fee output in the quote, so 300 bps (3%)
 * blocks the egregious overcharges while letting small/moderate swaps through.
 * Tune with lordbutterfly as the contract situation evolves.
 */
export const SWAP_FEE_GUARD_BPS = 300; // 3%

/** True when a modelled swap fee is above the safety threshold. */
export function swapFeeExceedsGuard(feeBps: number | undefined | null): boolean {
	return feeBps != null && feeBps > SWAP_FEE_GUARD_BPS;
}

/** Single source of truth for the user-facing guard message. */
export function swapFeeGuardMessage(feeBps: number | undefined | null): string {
	const pct = feeBps != null ? (feeBps / 100).toFixed(1) : '?';
	return (
		`Swap cancelled to protect you: the network would currently charge an abnormally high fee ` +
		`(~${pct}%, well above the usual ~0.1%) on this trade. Try a smaller amount, or wait until ` +
		`this is resolved.`
	);
}

/** Effective fee in bps = totalFee / grossOut, where grossOut = out + fee. */
function feeBpsOf(totalFee: bigint, expectedOutput: bigint): number {
	const grossOut = expectedOutput + totalFee;
	if (grossOut <= 0n) return 0;
	return Number((totalFee * 10000n) / grossOut);
}

/**
 * Fetch current pool reserves from the VSC GraphQL endpoint for a specific
 * pool contract. Callers are responsible for resolving the right contract ID
 * (e.g. via `fetchPoolRegistry` or a selected pool).
 */
export async function fetchPoolDepths(
	poolContractId: string
): Promise<PoolDepths | null> {
	if (!poolContractId) return null;
	try {
		const result = await queryOnce(new GetStateByKeysStore(), {
			variables: {
				contractId: poolContractId,
				keys: [KEY_RESERVE_0, KEY_RESERVE_1],
				encoding: 'hex'
			},
			policy: 'NetworkOnly'
		});
		const state = result.data?.getStateByKeys;
		if (!state) return null;

		const r0 = hexToBigInt(state[KEY_RESERVE_0]);
		const r1 = hexToBigInt(state[KEY_RESERVE_1]);
		if (r0 == null || r1 == null) return null;

		return { reserve0: r0, reserve1: r1 };
	} catch (err) {
		console.error('Failed to fetch pool depths', err);
		return null;
	}
}

/**
 * Look up a pool contract in the indexer registry by its asset pair
 * (order-independent). Returns the first matching pool. Use when callers
 * only know the assets, not the contract ID directly.
 */
export async function findPoolByPair(
	assetA: string,
	assetB: string
): Promise<string | null> {
	const a = assetA.toUpperCase();
	const b = assetB.toUpperCase();
	try {
		const registry = await fetchPoolRegistry();
		const hit = registry.find((p) => {
			const [s0, s1] = [p.symbols[0].toUpperCase(), p.symbols[1].toUpperCase()];
			return (s0 === a && s1 === b) || (s0 === b && s1 === a);
		});
		return hit?.contractId ?? null;
	} catch (err) {
		console.error('findPoolByPair failed', err);
		return null;
	}
}

/**
 * Calculate swap fees and worst-case expected output.
 *
 * The returned `baseFee` / `clpFee` / `totalFee` are the **charged**
 * fees at the stabilizer cap (i.e. base × 2). UI components that want
 * the unmultiplied base fees can recover them as `totalFee / 2`.
 *
 * @param x         Input amount (smallest units)
 * @param X         Reserve of input asset (smallest units)
 * @param Y         Reserve of output asset (smallest units)
 * @param slippageBps  Slippage tolerance in basis points (e.g. 100 = 1%).
 *                     Now only needs to absorb normal AMM reserve drift
 *                     between sign and execute — the stabilizer surplus
 *                     is already baked into `expectedOutput`.
 */
export function calculateSwap(
	x: bigint,
	X: bigint,
	Y: bigint,
	slippageBps: number
): SwapCalcResult {
	if (x <= 0n || X <= 0n || Y <= 0n) {
		return {
			baseFee: 0n,
			clpFee: 0n,
			totalFee: 0n,
			expectedOutput: 0n,
			minAmountOut: 0n,
			slippageBps,
			feeBps: 0
		};
	}

	// grossOut = Y - (X * Y) / (X + x)  — constant-product invariant, pre-fee
	const newX = X + x;
	const grossOut = Y - (X * Y) / newX;

	// Base fees, before stabilizer multiplier (mirror on-chain at m=1):
	//   protocol fee = grossOut * 8 / 10000   (output units, floor 1)
	//   CLP fee      = (x^2 * Y) / (x + X)^2  (output units, floor 1)
	let baseProtocolFee = (grossOut * 8n) / 10000n;
	if (baseProtocolFee === 0n) baseProtocolFee = 1n;

	let baseClpFee = (x * x * Y) / (newX * newX);
	if (baseClpFee === 0n) baseClpFee = 1n;

	// Post-2026-06-19 contract fix (`incentive-pendulum/wasm/applier.go`):
	//   • protocol leg × stabilizer `m` — we use the worst case (m = 2.0 at the
	//     cap) so `expectedOutput` is a guaranteed FLOOR over any real m ∈ [1,2].
	//   • CLP leg × the CONSTANT `CLP_SCALE_BPS` (625 = 1/16), NO stabilizer.
	//     (Pre-fix this also got `m`, charging ≈2× price impact — the bug milo
	//     fixed.) `charged = floor(base * bps / BpsScale)`.
	const chargedProtocolFee = (baseProtocolFee * STABILIZER_CAP_BPS) / BPS_SCALE;
	const chargedClpFee = (baseClpFee * CLP_SCALE_BPS) / BPS_SCALE;
	const totalFee = chargedProtocolFee + chargedClpFee;

	// expectedOutput is the worst-case net delivery (m = 2.0).
	// Actual on-chain delivery for any real m ∈ [1, 2] is ≥ this number,
	// so the contract's `actualOutput ≥ min_amount_out` gate always passes
	// for the stabilizer portion when slippage ≥ 0 (slippage just covers
	// normal reserve drift now).
	let expectedOutput = grossOut - totalFee;
	if (expectedOutput < 0n) {
		expectedOutput = 0n;
	}

	// min_amount_out = expectedOutput * (10000 - slippageBps) / 10000
	const slipBps = BigInt(Math.max(0, Math.min(slippageBps, 10000)));
	const minAmountOut = (expectedOutput * (10000n - slipBps)) / 10000n;

	// `feeBps` drives the overcharge guard, and is computed from the STRUCTURAL
	// (un-floored) fee — NOT `totalFee`. The `floor 1` minimums above are a fixed
	// sub-unit cost (mirroring the on-chain minimum), not the percentage-scaling
	// overcharge the guard exists to catch. On dust trades they dominate: a 1-unit
	// protocol floor × the 2× stabilizer is 2 units, which on a ~20-unit gross
	// output reads as ~10% and would wrongly BLOCK an economically negligible
	// (~$0.0005) swap. The structural fee is ≈0 for dust (so the guard ignores it)
	// while still rising with a genuine large-fee regression. `totalFee` /
	// `expectedOutput` keep the floored values so the quote stays honest about
	// what's actually charged.
	const structuralFee =
		((grossOut * 8n) / 10000n) * (STABILIZER_CAP_BPS / BPS_SCALE) +
		(((x * x * Y) / (newX * newX)) * CLP_SCALE_BPS) / BPS_SCALE;

	return {
		baseFee: chargedProtocolFee,
		clpFee: chargedClpFee,
		totalFee,
		expectedOutput,
		minAmountOut,
		slippageBps,
		feeBps: feeBpsOf(structuralFee, grossOut - structuralFee)
	};
}

/**
 * Determine pool reserves (X, Y) based on which asset is input.
 * reserve0 = HIVE, reserve1 = HBD.
 * If swapping HIVE->HBD: X=reserve0, Y=reserve1
 * If swapping HBD->HIVE: X=reserve1, Y=reserve0
 */
export function getOrderedDepths(
	depths: PoolDepths,
	assetIn: 'hive' | 'hbd'
): { X: bigint; Y: bigint } {
	if (assetIn === 'hive') {
		return { X: depths.reserve0, Y: depths.reserve1 };
	}
	return { X: depths.reserve1, Y: depths.reserve0 };
}

/**
 * Generalized version of `getOrderedDepths` that works for any pool
 * regardless of alphabetical asset ordering. Returns `{X, Y}` with X
 * = reserve of `assetIn`, Y = reserve of the other asset, or null if
 * the pool doesn't contain `assetIn`.
 */
export function getOrderedDepthsFor(
	depths: TypedPoolDepths,
	assetIn: string
): { X: bigint; Y: bigint } | null {
	const a = assetIn.toLowerCase();
	if (depths.asset0 === a) return { X: depths.reserve0, Y: depths.reserve1 };
	if (depths.asset1 === a) return { X: depths.reserve1, Y: depths.reserve0 };
	return null;
}

/**
 * Fetch depths for a single pool identified by its asset pair. Uses
 * chain state first (GetStateByKeysStore) and falls back to the
 * indexer's `dex_pool_liquidity` snapshot when chain state returns
 * null — some pools (observed on testnet BTC:HBD) aren't exposed
 * through the observer API so the indexer snapshot is our only
 * source of truth for reserves on those.
 *
 * Each network path retries once after 500 ms on a thrown error so a
 * transient indexer timeout doesn't look like a missing pool to the
 * caller. Returns null only if the pool isn't in the registry OR if
 * both attempts at both sources failed / returned unusable numbers.
 */
export async function fetchTypedPoolDepths(
	assetA: string,
	assetB: string
): Promise<TypedPoolDepths | null> {
	const registry = await fetchPoolRegistry().catch(() => []);
	const a = assetA.toLowerCase();
	const b = assetB.toLowerCase();
	const entry = registry.find((p) => {
		const s0 = p.symbols[0].toLowerCase();
		const s1 = p.symbols[1].toLowerCase();
		return (s0 === a && s1 === b) || (s0 === b && s1 === a);
	});
	if (!entry) return null;

	const asset0 = entry.symbols[0].toLowerCase();
	const asset1 = entry.symbols[1].toLowerCase();

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	// Try chain state first, with one 500 ms retry on transient failure.
	// Pool contract stores reserves under short keys `r0` / `r1` as raw
	// big-endian big.Int bytes; request with `encoding: 'hex'` so the
	// GraphQL layer doesn't mangle high bytes through UTF-8.
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const result = await queryOnce(new GetStateByKeysStore(), {
				variables: {
					contractId: entry.contractId,
					keys: [KEY_RESERVE_0, KEY_RESERVE_1],
					encoding: 'hex'
				},
				policy: 'NetworkOnly'
			});
			const state = result.data?.getStateByKeys;
			const r0 = hexToBigInt(state?.[KEY_RESERVE_0]);
			const r1 = hexToBigInt(state?.[KEY_RESERVE_1]);
			if (r0 != null && r1 != null) {
				return {
					contractId: entry.contractId,
					asset0,
					asset1,
					reserve0: r0,
					reserve1: r1
				};
			}
			break; // state fetched OK but reserves missing → fall through to indexer
		} catch (err) {
			if (attempt === 0) {
				await sleep(500);
				continue;
			}
			console.warn('fetchTypedPoolDepths chain-state path failed, falling back to indexer', err);
		}
	}

	// Indexer snapshot fallback, also with one retry.
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const snap = await fetchPoolLiquiditySnapshot(entry.contractId);
			if (!snap) return null;
			return {
				contractId: entry.contractId,
				asset0,
				asset1,
				reserve0: BigInt(Math.floor(snap.reserve0)),
				reserve1: BigInt(Math.floor(snap.reserve1))
			};
		} catch (err) {
			if (attempt === 0) {
				await sleep(500);
				continue;
			}
			console.error('fetchTypedPoolDepths indexer fallback failed after retry', err);
			return null;
		}
	}
	return null;
}

/**
 * AMM-based price impact in percent (0–100) using the constant-product
 * formula  impact = x / (X + x)  where X is the pool's input-side reserve
 * and x is the trade size. Both must be in the same smallest-unit base.
 *
 * For two-hop routes (BTC ↔ HIVE via HBD) the impacts compound:
 *   combined = 1 - (1 - impact1) × (1 - impact2)
 *
 * Returns 0 when any required pool data is missing.
 */
/**
 * Build a route from the two native pools. Kept so the native-only callers
 * (the dashboard QuickSwap card) can stay on the two-pool signature while the
 * routing logic itself lives in one place.
 */
function nativeRoute(
	assetIn: string,
	assetOut: string,
	hiveHbdPool: TypedPoolDepths | null,
	btcHbdPool: TypedPoolDepths | null
): SwapHop[] | null {
	const pools = [hiveHbdPool, btcHbdPool].filter((p): p is TypedPoolDepths => p != null);
	return buildSwapRoute(
		assetIn,
		assetOut,
		(a, b) =>
			pools.find(
				(p) =>
					(p.asset0 === a && p.asset1 === b) || (p.asset0 === b && p.asset1 === a)
			) ?? null
	);
}

/**
 * AMM-based price impact in percent (0–100) for a native pair, using the
 * constant-product formula. Two-hop routes (BTC ↔ HIVE via HBD) compound.
 * Returns 0 when any required pool data is missing.
 *
 * Prefer `priceImpactForRoute` for anything that can involve a custom token.
 */
export function calculatePriceImpact(
	x: bigint,
	assetIn: string,
	assetOut: string,
	hiveHbdPool: TypedPoolDepths | null,
	btcHbdPool: TypedPoolDepths | null
): number {
	return priceImpactForRoute(x, nativeRoute(assetIn, assetOut, hiveHbdPool, btcHbdPool));
}

/**
 * Returns true when the input amount `x` would be rejected on-chain because
 * it exceeds 50 % of the input-side reserve in one or both hops.
 *
 * Prefer `exceedsPoolDepthForRoute` for anything that can involve a custom token.
 */
export function checkExceedsPoolDepth(
	x: bigint,
	assetIn: string,
	assetOut: string,
	hiveHbdPool: TypedPoolDepths | null,
	btcHbdPool: TypedPoolDepths | null
): boolean {
	return exceedsPoolDepthForRoute(x, nativeRoute(assetIn, assetOut, hiveHbdPool, btcHbdPool));
}

/**
 * Execute a two-hop swap calc: input → hopAsset (in pool1) →
 * output (in pool2). Fees accumulate from both hops. Slippage is
 * applied only to the FINAL output, which matches the router's
 * behavior (each hop runs at live price, the slippage guard fires
 * only on the final receive amount).
 */
export function calculateTwoHopSwap(
	x: bigint,
	pool1: TypedPoolDepths,
	pool2: TypedPoolDepths,
	assetIn: string,
	hopAsset: string,
	assetOut: string,
	slippageBps: number
): SwapCalcResult {
	const hop1Depths = getOrderedDepthsFor(pool1, assetIn);
	if (!hop1Depths) {
		return {
			baseFee: 0n,
			clpFee: 0n,
			totalFee: 0n,
			expectedOutput: 0n,
			minAmountOut: 0n,
			slippageBps,
			feeBps: 0
		};
	}
	// First hop runs at its own pool and produces an intermediate amount.
	const hop1 = calculateSwap(x, hop1Depths.X, hop1Depths.Y, 0);
	const hop1Fee = {
		asset: hopAsset,
		baseFee: hop1.baseFee,
		clpFee: hop1.clpFee,
		totalFee: hop1.totalFee
	};
	if (hop1.expectedOutput <= 0n) {
		return { ...hop1, slippageBps, hop1Fee };
	}

	const hop2Depths = getOrderedDepthsFor(pool2, hopAsset);
	if (!hop2Depths) {
		return {
			baseFee: 0n,
			clpFee: 0n,
			totalFee: 0n,
			expectedOutput: 0n,
			minAmountOut: 0n,
			slippageBps,
			feeBps: hop1.feeBps,
			hop1Fee
		};
	}
	const hop2 = calculateSwap(hop1.expectedOutput, hop2Depths.X, hop2Depths.Y, slippageBps);

	// Fees are output-denominated at each hop: hop1 fees are in `hopAsset`,
	// hop2 fees are in `assetOut`. The top-level fee fields hold hop2 (in
	// `assetOut`); `hop1Fee` carries hop1's separately so callers can
	// render "<hop1Total> <hopAsset> and <hop2Total> <assetOut>".
	return {
		baseFee: hop2.baseFee,
		clpFee: hop2.clpFee,
		totalFee: hop2.totalFee,
		expectedOutput: hop2.expectedOutput,
		minAmountOut: hop2.minAmountOut,
		slippageBps,
		// Both hops are taxed by the CLP fee, so the effective cost compounds.
		feeBps: hop1.feeBps + hop2.feeBps,
		hop1Fee
	};
}

// ─── Generic routing ─────────────────────────────────────────────────────────
//
// `calculatePriceImpact` / `checkExceedsPoolDepth` above were written when the
// DEX had exactly two pools, so they take `hiveHbdPool` and `btcHbdPool` as
// named arguments and branch on the literal asset names. Custom-token pools
// don't fit that shape — there is one per token — so the logic is expressed
// here against a resolved ROUTE instead, and those two functions are kept as
// thin wrappers over it for callers that only ever deal with the native pair.

/** One leg of a swap: an amount of `assetIn` entering `pool`, leaving as
 *  `assetOut`. Both names are lowercase. */
export type SwapHop = {
	pool: TypedPoolDepths;
	assetIn: string;
	assetOut: string;
};

/** HBD is the DEX's base asset — every pool pairs against it (see
 *  docs.magi.eco), so any two assets either share a pool directly or route
 *  through HBD in two hops. */
export const DEX_BASE_ASSET = 'hbd';

/**
 * Build a route from pools that are already in hand. `findPool(a, b)` must
 * return the pool for that (unordered) pair, or null. Returns null when no
 * route exists — same-asset, or a missing pool on either leg.
 */
export function buildSwapRoute(
	assetIn: string,
	assetOut: string,
	findPool: (a: string, b: string) => TypedPoolDepths | null
): SwapHop[] | null {
	const aIn = assetIn?.toLowerCase();
	const aOut = assetOut?.toLowerCase();
	if (!aIn || !aOut || aIn === aOut) return null;

	const direct = findPool(aIn, aOut);
	if (direct) return [{ pool: direct, assetIn: aIn, assetOut: aOut }];

	// No direct pool. A pair already involving the base asset has nowhere left
	// to hop, so it's simply untradeable rather than a two-hop route.
	if (aIn === DEX_BASE_ASSET || aOut === DEX_BASE_ASSET) return null;

	const first = findPool(aIn, DEX_BASE_ASSET);
	const second = findPool(DEX_BASE_ASSET, aOut);
	if (!first || !second) return null;
	return [
		{ pool: first, assetIn: aIn, assetOut: DEX_BASE_ASSET },
		{ pool: second, assetIn: DEX_BASE_ASSET, assetOut: aOut }
	];
}

/**
 * Resolve the route for a pair, fetching pool reserves as needed. Handles
 * every pair the DEX can serve, including custom tokens, without the caller
 * knowing which pools exist. Returns null when the pair isn't tradeable.
 */
export async function resolveSwapRoute(
	assetIn: string,
	assetOut: string
): Promise<SwapHop[] | null> {
	const aIn = assetIn?.toLowerCase();
	const aOut = assetOut?.toLowerCase();
	if (!aIn || !aOut || aIn === aOut) return null;

	const direct = await fetchTypedPoolDepths(aIn, aOut);
	if (direct) return [{ pool: direct, assetIn: aIn, assetOut: aOut }];

	if (aIn === DEX_BASE_ASSET || aOut === DEX_BASE_ASSET) return null;

	const [first, second] = await Promise.all([
		fetchTypedPoolDepths(aIn, DEX_BASE_ASSET),
		fetchTypedPoolDepths(DEX_BASE_ASSET, aOut)
	]);
	if (!first || !second) return null;
	return [
		{ pool: first, assetIn: aIn, assetOut: DEX_BASE_ASSET },
		{ pool: second, assetIn: DEX_BASE_ASSET, assetOut: aOut }
	];
}

/**
 * AMM price impact in percent (0–100) across a whole route. Impacts compound:
 * `combined = 1 - Π(1 - impact_hop)`. Each hop is sized from the previous
 * hop's GROSS constant-product output (pre-fee), matching the impact figure
 * the two-pool version reported.
 */
export function priceImpactForRoute(x: bigint, route: SwapHop[] | null): number {
	if (x <= 0n || !route || route.length === 0) return 0;
	let amount = x;
	let survival = 1;
	for (let i = 0; i < route.length; i++) {
		const hop = route[i];
		const d = getOrderedDepthsFor(hop.pool, hop.assetIn);
		if (!d || d.X <= 0n) return 0;
		survival *= 1 - Number(amount) / Number(d.X + amount);
		// Only size the NEXT hop. Carrying this past the last hop would run a
		// BigInt division whose result floors to 0 for small trades against a
		// low-decimal reserve (1 HBD into the BTC pool), which then read as
		// "no impact" instead of the impact just measured.
		if (i === route.length - 1) break;
		amount = (amount * d.Y) / (d.X + amount);
		if (amount <= 0n) return 0;
	}
	return (1 - survival) * 100;
}

/**
 * True when the trade would be rejected on-chain for exceeding 50 % of an
 * input-side reserve on any hop. Later hops are sized from the previous hop's
 * NET output (fees taken), since that is what actually arrives at the pool.
 */
export function exceedsPoolDepthForRoute(x: bigint, route: SwapHop[] | null): boolean {
	if (x <= 0n || !route || route.length === 0) return false;
	let amount = x;
	for (let i = 0; i < route.length; i++) {
		const hop = route[i];
		const d = getOrderedDepthsFor(hop.pool, hop.assetIn);
		if (!d) return false;
		if (amount * 2n > d.X) return true;
		if (i === route.length - 1) break;
		amount = calculateSwap(amount, d.X, d.Y, 0).expectedOutput;
		if (amount <= 0n) return false;
	}
	return false;
}

/** Empty quote, for routes that can't be priced. */
function emptySwapResult(slippageBps: number): SwapCalcResult {
	return {
		baseFee: 0n,
		clpFee: 0n,
		totalFee: 0n,
		expectedOutput: 0n,
		minAmountOut: 0n,
		slippageBps,
		feeBps: 0
	};
}

/**
 * Quote a swap over a resolved route — the routing-aware entry point that
 * replaces picking between `calculateSwap` and `calculateTwoHopSwap` by hand.
 */
export function calculateRouteSwap(
	x: bigint,
	route: SwapHop[] | null,
	slippageBps: number
): SwapCalcResult {
	if (!route || route.length === 0) return emptySwapResult(slippageBps);

	if (route.length === 1) {
		const [hop] = route;
		const d = getOrderedDepthsFor(hop.pool, hop.assetIn);
		if (!d) return emptySwapResult(slippageBps);
		return calculateSwap(x, d.X, d.Y, slippageBps);
	}

	const [hop1, hop2] = route;
	return calculateTwoHopSwap(
		x,
		hop1.pool,
		hop2.pool,
		hop1.assetIn,
		hop1.assetOut,
		hop2.assetOut,
		slippageBps
	);
}
