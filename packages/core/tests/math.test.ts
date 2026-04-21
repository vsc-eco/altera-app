import { describe, expect, it } from 'vitest';
import { calculateSwap, calculateTwoHopSwap } from '../src/math/swap.js';
import type { PoolDepths } from '../src/types/index.js';

/**
 * Math validation for the output-denominated fee model introduced in the
 * Go contract. Pool state is taken from the pre-swap state of tx
 * `9a6ad6c7...` (vaultec's 100 HBD → BTC swap at block 105609427) so the
 * inputs remain a realistic fixture, but expected values are computed
 * from the new formula:
 *
 *   grossOut = Y − (X*Y) / (X + x)
 *   baseFee  = grossOut * 8 / 10000                    (floor 1)
 *   clpFee   = (x^2 * Y) / (x + X)^2                   (floor 1)
 *   amountOut = grossOut − baseFee − clpFee
 *
 * BTC reserve: 661_105 sats, HBD reserve: 504_685 mHBD, input 100_000 mHBD.
 */
describe('calculateSwap — output-denominated fees', () => {
	it('produces amount_out per the output-side fee model', () => {
		const x = 100_000n;
		const X = 504_685n; // HBD reserve (input side)
		const Y = 661_105n; // BTC reserve (output side)
		const result = calculateSwap(x, X, Y, 100);

		// grossOut = 661105 − floor(504685*661105 / 604685) = 661105 − 551774 = 109331
		// baseFee  = floor(109331 * 8 / 10000) = 87
		// clpFee   = floor(100000^2 * 661105 / 604685^2) = 18080
		// amountOut = 109331 − 87 − 18080 = 91164
		expect(result.baseFee).toBe(87n);
		expect(result.clpFee).toBe(18_080n);
		expect(result.expectedOutput).toBe(91_164n);
	});

	it('decomposes fees per the new formula', () => {
		const x = 100_000n;
		const X = 504_685n;
		const Y = 661_105n;
		const result = calculateSwap(x, X, Y, 0);

		expect(result.baseFee).toBe(87n);
		expect(result.clpFee).toBe(18_080n);
		expect(result.totalFee).toBe(18_167n);
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
		const expectedMin = (91_164n * 9900n) / 10000n;
		expect(result.minAmountOut).toBe(expectedMin);
	});

	it('floors baseFee and clpFee at 1 when they would round to 0 (matches contract)', () => {
		// Tiny trade into a huge pool — both fee components compute < 1 pre-floor.
		const result = calculateSwap(1n, 10n ** 12n, 10n ** 12n, 0);
		expect(result.baseFee).toBe(1n);
		expect(result.clpFee).toBe(1n);
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
