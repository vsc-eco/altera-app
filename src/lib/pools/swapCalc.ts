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
import { HIVE_HBD_POOL_CONTRACT_ID } from './poolsData';

export interface PoolDepths {
	reserve0: bigint; // HIVE reserve (smallest units)
	reserve1: bigint; // HBD reserve (smallest units)
}

export interface SwapCalcResult {
	baseFee: bigint;
	clpFee: bigint;
	totalFee: bigint;
	expectedOutput: bigint;
	minAmountOut: bigint;
	slippageBps: number; // basis points (e.g. 100 = 1%)
}

/**
 * Fetch current pool reserves from the VSC GraphQL endpoint.
 */
export async function fetchPoolDepths(): Promise<PoolDepths | null> {
	try {
		const result = await new GetStateByKeysStore().fetch({
			variables: {
				contractId: HIVE_HBD_POOL_CONTRACT_ID,
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
