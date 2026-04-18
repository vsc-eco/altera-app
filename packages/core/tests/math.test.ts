import { describe, expect, it } from 'vitest';
import { calculateSwap, calculateTwoHopSwap } from '../src/math/swap.js';
import type { PoolDepths } from '../src/types/index.js';

/**
 * Math validation against live on-chain tx `9a6ad6c7...` (vaultec's
 * 100 HBD → BTC swap at block 105609427). Inputs and expected outputs
 * were captured from the VSC GraphQL API during the 2026-04-17 analysis.
 *
 * Pre-swap pool state (from the prior swap at block 105606353, output
 * `bafyreicmkeaob2lr2m77mw343ocm34azigsyvcqj7mhhs6lvlcx3l6m7ky`):
 *   BTC reserve: 661_105 sats
 *   HBD reserve: 504_685 mHBD
 * Input: 100.000 HBD = 100_000 mHBD
 * Expected output (from contract ret): 92_247 sats
 */
describe('calculateSwap — validated against live tx 9a6ad6c7', () => {
	it('produces the exact on-chain amount_out for vaultec 100 HBD → BTC', () => {
		const x = 100_000n;
		const X = 504_685n; // HBD reserve (input side)
		const Y = 661_105n; // BTC reserve (output side)
		const result = calculateSwap(x, X, Y, 100);

		expect(result.baseFee).toBe(80n);
		expect(result.expectedOutput).toBe(92_247n);
	});

	it('decomposes fees per the Altera formula', () => {
		const x = 100_000n;
		const X = 504_685n;
		const Y = 661_105n;
		const result = calculateSwap(x, X, Y, 0);

		// baseFee = x * 8 / 10000 = 80
		expect(result.baseFee).toBe(80n);
		// clpFee = (x^2 * Y) / (x + X)^2
		//        = (100000^2 * 661105) / (604685^2)
		//        = floor(6.61105e15 / 3.656439e11) = 18_080
		expect(result.clpFee).toBe(18_080n);
		expect(result.totalFee).toBe(18_160n);
	});

	it('returns zeros for invalid inputs', () => {
		expect(calculateSwap(0n, 100n, 100n, 100).expectedOutput).toBe(0n);
		expect(calculateSwap(100n, 0n, 100n, 100).expectedOutput).toBe(0n);
		expect(calculateSwap(100n, 100n, 0n, 100).expectedOutput).toBe(0n);
	});

	it('applies slippage to minAmountOut correctly', () => {
		const x = 100_000n;
		const X = 504_685n;
		const Y = 661_105n;
		// 1% slippage — min = expected * 9900 / 10000
		const result = calculateSwap(x, X, Y, 100);
		const expected = 92_247n;
		const expectedMin = (expected * 9900n) / 10000n;
		expect(result.minAmountOut).toBe(expectedMin);
	});
});

describe('calculateTwoHopSwap — HIVE → HBD → BTC', () => {
	it('routes through HBD hop and produces a non-zero output for a plausible trade', () => {
		// Approx pool states on 2026-04-17 for HIVE/HBD and BTC/HBD
		const hiveHbd: PoolDepths = {
			contractId: 'dummy1',
			asset0: 'hbd',
			asset1: 'hive',
			reserve0: 502_180n,
			reserve1: 8_108_542n
		};
		const btcHbd: PoolDepths = {
			contractId: 'dummy2',
			asset0: 'btc',
			asset1: 'hbd',
			reserve0: 568_858n,
			reserve1: 600_145n
		};
		const result = calculateTwoHopSwap(
			30_000n, // 30 HIVE
			hiveHbd,
			btcHbd,
			'hive',
			'hbd',
			'btc',
			100
		);
		expect(result.expectedOutput).toBeGreaterThan(0n);
		// Two-hop should be less than single-hop at ideal rate — just sanity.
		expect(result.expectedOutput).toBeLessThan(10_000n);
	});
});
