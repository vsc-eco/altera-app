import type { PoolDepths, SwapCalcResult } from '../types/index.js';

/**
 * Swap fee + output calculation using BigInt integer math.
 *
 * All amounts in smallest units (HIVE/HBD: 3 decimals, BTC: 8 decimals).
 *
 *   baseFee  = x * 8 / 10000                  (= 0.08% of input)
 *   clpFee   = (x^2 * Y) / (x + X)^2          (CLP curve fee)
 *   totalFee = baseFee + clpFee
 *   output   = Y − (X * Y) / (X + x − totalFee)
 *   minOut   = output * (10000 − slippageBps) / 10000
 *
 * Ported verbatim from altera-app/src/lib/pools/swapCalc.ts:111-163 so that
 * fee previews match the contract bit-for-bit. Any change here must track
 * the Altera formula.
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

	const baseFee = (x * 8n) / 10000n;
	const xPlusX = x + X;
	const clpFee = (x * x * Y) / (xPlusX * xPlusX);
	const totalFee = baseFee + clpFee;

	const denominator = X + x - totalFee;
	let expectedOutput: bigint;
	if (denominator <= 0n) {
		expectedOutput = 0n;
	} else {
		expectedOutput = Y - (X * Y) / denominator;
	}
	if (expectedOutput < 0n) expectedOutput = 0n;

	const slipBps = BigInt(Math.max(0, Math.min(slippageBps, 10000)));
	const minAmountOut = (expectedOutput * (10000n - slipBps)) / 10000n;

	return { baseFee, clpFee, totalFee, expectedOutput, minAmountOut, slippageBps };
}

/** Return `{ X, Y }` with X = reserve of `assetIn`, Y = reserve of the other asset. */
export function getOrderedDepthsFor(
	depths: PoolDepths,
	assetIn: string
): { X: bigint; Y: bigint } | null {
	const a = assetIn.toLowerCase();
	if (depths.asset0 === a) return { X: depths.reserve0, Y: depths.reserve1 };
	if (depths.asset1 === a) return { X: depths.reserve1, Y: depths.reserve0 };
	return null;
}

/**
 * Two-hop swap calc: input → hopAsset (via pool1) → output (via pool2).
 * Slippage applies only to the final output, matching router behavior.
 *
 * Ported from altera-app/src/lib/pools/swapCalc.ts:289-342.
 */
export function calculateTwoHopSwap(
	x: bigint,
	pool1: PoolDepths,
	pool2: PoolDepths,
	assetIn: string,
	hopAsset: string,
	_assetOut: string,
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

	return {
		baseFee: hop1.baseFee,
		clpFee: hop1.clpFee,
		totalFee: hop1.totalFee,
		expectedOutput: hop2.expectedOutput,
		minAmountOut: hop2.minAmountOut,
		slippageBps
	};
}
