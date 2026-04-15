/**
 * Swap fee and output calculations using BigInt integer math.
 *
 * All amounts are in smallest units (3 decimal places for HIVE/HBD,
 * i.e. 1.000 HIVE = 1000).
 *
 * Formulas:
 *   base fee  = 0.0008 * x           (= x * 8 / 10000)
 *   CLP fee   = (x^2 * Y) / (x + X)^2
 *   total fee = base fee + CLP fee
 *   expected output y = Y - (X * Y) / (X + x - totalFee)
 *   min_amount_out   = y * (10000 - slippageBps) / 10000
 */

import { GetStateByKeysStore } from '$houdini';
import { fetchPoolRegistry, fetchPoolLiquiditySnapshot } from './poolsData';

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
		const result = await new GetStateByKeysStore().fetch({
			variables: {
				contractId: poolContractId,
				keys: ['reserve0', 'reserve1']
			},
			policy: 'NetworkOnly'
		});
		const state = result.data?.getStateByKeys;
		if (!state) return null;

		const r0 = state['reserve0'];
		const r1 = state['reserve1'];
		if (r0 == null || r1 == null) return null;

		return {
			reserve0: BigInt(r0),
			reserve1: BigInt(r1)
		};
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
 * Calculate swap fees and expected output using pure integer arithmetic.
 *
 * @param x         Input amount (smallest units)
 * @param X         Reserve of input asset (smallest units)
 * @param Y         Reserve of output asset (smallest units)
 * @param slippageBps  Slippage tolerance in basis points (e.g. 100 = 1%)
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
			slippageBps
		};
	}

	// base fee = x * 8 / 10000  (0.0008 * x)
	const baseFee = (x * 8n) / 10000n;

	// CLP fee = (x^2 * Y) / (x + X)^2
	const xPlusX = x + X;
	const clpFee = (x * x * Y) / (xPlusX * xPlusX);

	const totalFee = baseFee + clpFee;

	// expected output: y = Y - (X * Y) / (X + x - totalFee)
	const denominator = X + x - totalFee;
	let expectedOutput: bigint;
	if (denominator <= 0n) {
		expectedOutput = 0n;
	} else {
		expectedOutput = Y - (X * Y) / denominator;
	}

	// Clamp to non-negative
	if (expectedOutput < 0n) {
		expectedOutput = 0n;
	}

	// min_amount_out = expectedOutput * (10000 - slippageBps) / 10000
	const slipBps = BigInt(Math.max(0, Math.min(slippageBps, 10000)));
	const minAmountOut = (expectedOutput * (10000n - slipBps)) / 10000n;

	return {
		baseFee,
		clpFee,
		totalFee,
		expectedOutput,
		minAmountOut,
		slippageBps
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
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const result = await new GetStateByKeysStore().fetch({
				variables: { contractId: entry.contractId, keys: ['reserve0', 'reserve1'] },
				policy: 'NetworkOnly'
			});
			const state = result.data?.getStateByKeys;
			const r0 = state?.['reserve0'];
			const r1 = state?.['reserve1'];
			if (r0 != null && r1 != null) {
				return {
					contractId: entry.contractId,
					asset0,
					asset1,
					reserve0: BigInt(r0),
					reserve1: BigInt(r1)
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
			slippageBps
		};
	}
	// First hop runs at its own pool and produces an intermediate amount.
	const hop1 = calculateSwap(x, hop1Depths.X, hop1Depths.Y, 0);
	if (hop1.expectedOutput <= 0n) {
		return { ...hop1, slippageBps };
	}

	const hop2Depths = getOrderedDepthsFor(pool2, hopAsset);
	if (!hop2Depths) {
		return {
			baseFee: hop1.baseFee,
			clpFee: hop1.clpFee,
			totalFee: hop1.totalFee,
			expectedOutput: 0n,
			minAmountOut: 0n,
			slippageBps
		};
	}
	const hop2 = calculateSwap(hop1.expectedOutput, hop2Depths.X, hop2Depths.Y, slippageBps);

	// Fees from hop1 are denominated in `assetIn`; fees from hop2 are
	// in `hopAsset`. Returning the fees as hop1-denominated (input asset)
	// makes them consistent with the single-hop path. Hop2 fees are
	// effectively reflected via the reduced final output. So we return
	// hop1 fees AS-IS and rely on expectedOutput from hop2 to show the
	// net-of-both-hops number.
	return {
		baseFee: hop1.baseFee,
		clpFee: hop1.clpFee,
		totalFee: hop1.totalFee,
		expectedOutput: hop2.expectedOutput,
		minAmountOut: hop2.minAmountOut,
		slippageBps
	};
}
