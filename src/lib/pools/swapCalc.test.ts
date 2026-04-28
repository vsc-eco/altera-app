/**
 * Tests for swapCalc.ts — pure math functions only (no network calls).
 *
 * Pool sizes use realistic approximations of mainnet reserves at the time
 * the pool-depth cap was introduced:
 *   HIVE/HBD pool: ~2,221,000 mHIVE : ~2,221,000 mHBD  (equal-value sides)
 *   BTC/HBD pool:  ~1,670 sat       : ~1,670,000 mHBD
 *
 * All amounts are in smallest units (3 dp for HIVE/HBD → ×1000, 8 dp for BTC → ×1e8).
 */

import { describe, it, expect } from 'vitest';
import {
	calculateSwap,
	calculateTwoHopSwap,
	getOrderedDepthsFor,
	checkExceedsPoolDepth,
	calculatePriceImpact,
	type TypedPoolDepths
} from './swapCalc';

// ─── Realistic pool fixtures ──────────────────────────────────────────────────

/** HIVE/HBD pool: reserve0=HIVE, reserve1=HBD (smallest units, 3 dp) */
const hiveHbdPool: TypedPoolDepths = {
	contractId: 'vs41q9c3yetfkv8xssdqtuy9jq3g25f3tjzsy82m4',
	asset0: 'hive',
	asset1: 'hbd',
	reserve0: 2_221_000n, // 2,221.000 HIVE
	reserve1: 2_221_000n  // 2,221.000 HBD (1:1 peg for simplicity)
};

/** BTC/HBD pool: reserve0=BTC (satoshis, 8 dp), reserve1=HBD (3 dp) */
const btcHbdPool: TypedPoolDepths = {
	contractId: 'vs41q9c3yetfkv8xssdqtuy9jq3g25f3tjzsy82m4b',
	asset0: 'btc',
	asset1: 'hbd',
	reserve0: 3_340n,       // 0.00003340 BTC ≈ $3,340 at $100k/BTC
	reserve1: 3_340_000n    // 3,340.000 HBD ≈ $3,340
};

// ─── getOrderedDepthsFor ──────────────────────────────────────────────────────

describe('getOrderedDepthsFor', () => {
	it('returns X=reserve0, Y=reserve1 when assetIn matches asset0', () => {
		const d = getOrderedDepthsFor(hiveHbdPool, 'hive');
		expect(d).toEqual({ X: 2_221_000n, Y: 2_221_000n });
	});

	it('returns X=reserve1, Y=reserve0 when assetIn matches asset1', () => {
		const d = getOrderedDepthsFor(hiveHbdPool, 'hbd');
		expect(d).toEqual({ X: 2_221_000n, Y: 2_221_000n });
	});

	it('is case-insensitive', () => {
		expect(getOrderedDepthsFor(hiveHbdPool, 'HIVE')).toEqual({ X: 2_221_000n, Y: 2_221_000n });
		expect(getOrderedDepthsFor(btcHbdPool, 'BTC')).toEqual({ X: 3_340n, Y: 3_340_000n });
	});

	it('returns null when assetIn is not in pool', () => {
		expect(getOrderedDepthsFor(hiveHbdPool, 'btc')).toBeNull();
		expect(getOrderedDepthsFor(btcHbdPool, 'hive')).toBeNull();
	});
});

// ─── calculateSwap ───────────────────────────────────────────────────────────

describe('calculateSwap', () => {
	it('returns zeros for zero input', () => {
		const r = calculateSwap(0n, 1_000_000n, 1_000_000n, 100);
		expect(r.expectedOutput).toBe(0n);
		expect(r.minAmountOut).toBe(0n);
	});

	it('returns zeros for zero reserves', () => {
		const r = calculateSwap(1000n, 0n, 1_000_000n, 100);
		expect(r.expectedOutput).toBe(0n);
	});

	it('small trade on deep pool has low price impact', () => {
		// 10 HIVE (10,000 units) into a 2,221 HIVE pool → ~0.45% of reserve
		const r = calculateSwap(10_000n, 2_221_000n, 2_221_000n, 100);
		expect(r.expectedOutput).toBeGreaterThan(0n);
		// grossOut ≈ 9,955 mHBD; after fees should be >9,900 mHBD
		expect(r.expectedOutput).toBeGreaterThan(9_900n);
	});

	it('large trade near 50% cap has very high CLP fee', () => {
		// 1,110 HIVE (1,110,000 units) = exactly 50% of reserve
		const r50pct = calculateSwap(1_110_000n, 2_221_000n, 2_221_000n, 100);
		// 10 HIVE trade for reference
		const rSmall = calculateSwap(10_000n, 2_221_000n, 2_221_000n, 100);

		// At 50%, CLP fee should dominate — effective rate much worse
		const rate50 = Number(r50pct.expectedOutput) / 1_110_000;
		const rateSmall = Number(rSmall.expectedOutput) / 10_000;
		expect(rate50).toBeLessThan(rateSmall * 0.7); // at least 30% worse rate
	});

	it('applies slippage correctly to minAmountOut', () => {
		const r = calculateSwap(10_000n, 2_221_000n, 2_221_000n, 100); // 1% slippage
		const expected = (r.expectedOutput * 9900n) / 10000n;
		expect(r.minAmountOut).toBe(expected);
	});

	it('minAmountOut ≤ expectedOutput always', () => {
		const r = calculateSwap(10_000n, 2_221_000n, 2_221_000n, 200);
		expect(r.minAmountOut).toBeLessThanOrEqual(r.expectedOutput);
	});
});

// ─── checkExceedsPoolDepth ────────────────────────────────────────────────────

describe('checkExceedsPoolDepth', () => {
	// ── Single-hop: HIVE → HBD ──

	it('returns false for zero input', () => {
		expect(checkExceedsPoolDepth(0n, 'hive', 'hbd', hiveHbdPool, btcHbdPool)).toBe(false);
	});

	it('returns false when input is exactly 50% of reserve (boundary)', () => {
		// x * 2 === X  →  NOT strictly greater, should pass
		const halfReserve = 2_221_000n / 2n; // 1,110,500 — floor of half
		expect(checkExceedsPoolDepth(halfReserve, 'hive', 'hbd', hiveHbdPool, null)).toBe(false);
	});

	it('returns true when input is just over 50% of reserve', () => {
		// reserve = 2,221,000 → half = 1,110,500 → one unit over
		const justOver = 2_221_000n / 2n + 1n;
		expect(checkExceedsPoolDepth(justOver, 'hive', 'hbd', hiveHbdPool, null)).toBe(true);
	});

	it('returns true for clearly excessive HIVE amount', () => {
		// 3,000 HIVE (3,000,000 units) >> 2,221 HIVE reserve
		expect(checkExceedsPoolDepth(3_000_000n, 'hive', 'hbd', hiveHbdPool, btcHbdPool)).toBe(true);
	});

	it('returns false for a reasonable HIVE→HBD trade', () => {
		// 100 HIVE = ~4.5% of reserve — fine
		expect(checkExceedsPoolDepth(100_000n, 'hive', 'hbd', hiveHbdPool, btcHbdPool)).toBe(false);
	});

	it('returns false when pool not loaded (null)', () => {
		expect(checkExceedsPoolDepth(3_000_000n, 'hive', 'hbd', null, btcHbdPool)).toBe(false);
	});

	// ── Single-hop: HBD → HIVE ──

	it('works symmetrically for HBD→HIVE', () => {
		const justOver = 2_221_000n / 2n + 1n;
		expect(checkExceedsPoolDepth(justOver, 'hbd', 'hive', hiveHbdPool, null)).toBe(true);
	});

	// ── Single-hop: BTC ↔ HBD ──

	it('returns true for BTC→HBD exceeding btcHbdPool input reserve', () => {
		// BTC reserve = 3,340 sat; just over half = 1,671 sat
		expect(checkExceedsPoolDepth(1_671n, 'btc', 'hbd', hiveHbdPool, btcHbdPool)).toBe(true);
	});

	it('returns false for small BTC→HBD trade', () => {
		// 100 sat = ~3% of btc reserve
		expect(checkExceedsPoolDepth(100n, 'btc', 'hbd', hiveHbdPool, btcHbdPool)).toBe(false);
	});

	it('returns true for HBD→BTC exceeding btcHbdPool HBD reserve', () => {
		// HBD reserve = 3,340,000; just over half = 1,670,001
		expect(checkExceedsPoolDepth(1_670_001n, 'hbd', 'btc', hiveHbdPool, btcHbdPool)).toBe(true);
	});

	// ── Two-hop: BTC ↔ HIVE ──

	it('returns true for large BTC→HIVE when BTC input exceeds btcHbd reserve', () => {
		// 2,000 sat >> 1,670 (half of 3,340 btc reserve)
		expect(checkExceedsPoolDepth(2_000n, 'btc', 'hive', hiveHbdPool, btcHbdPool)).toBe(true);
	});

	it('returns false for small BTC→HIVE trade on both hops', () => {
		// 50 sat → hop1 gives ~50,000 mHBD intermediate; hbd pool has 3,340,000 mHBD → fine
		expect(checkExceedsPoolDepth(50n, 'btc', 'hive', hiveHbdPool, btcHbdPool)).toBe(false);
	});

	it('returns false for small HIVE→BTC trade', () => {
		// 100 HIVE (100,000 units) into 2,221,000 reserve → ~4.5% — fine
		expect(checkExceedsPoolDepth(100_000n, 'hive', 'btc', hiveHbdPool, btcHbdPool)).toBe(false);
	});

	it('returns false when one pool is null for two-hop route', () => {
		expect(checkExceedsPoolDepth(3_000_000n, 'hive', 'btc', null, btcHbdPool)).toBe(false);
		expect(checkExceedsPoolDepth(3_000_000n, 'hive', 'btc', hiveHbdPool, null)).toBe(false);
	});
});

// ─── calculateTwoHopSwap ─────────────────────────────────────────────────────

describe('calculateTwoHopSwap', () => {
	it('produces a hop1Fee for two-hop routes', () => {
		// 50 sat BTC → HIVE via HBD
		const r = calculateTwoHopSwap(50n, btcHbdPool, hiveHbdPool, 'btc', 'hbd', 'hive', 100);
		expect(r.hop1Fee).toBeDefined();
		expect(r.hop1Fee!.asset).toBe('hbd');
		expect(r.hop1Fee!.totalFee).toBeGreaterThan(0n);
	});

	it('returns zero output for excessive input (> 50% reserve)', () => {
		// 3,000 sat >> 3,340 BTC reserve — hop1 gross output will drain pool
		const r = calculateTwoHopSwap(3_000n, btcHbdPool, hiveHbdPool, 'btc', 'hbd', 'hive', 100);
		// Output may be 0 or near-0 since grossOut - fees < 0
		expect(r.expectedOutput).toBeGreaterThanOrEqual(0n);
	});

	it('minAmountOut ≤ expectedOutput', () => {
		const r = calculateTwoHopSwap(50n, btcHbdPool, hiveHbdPool, 'btc', 'hbd', 'hive', 200);
		expect(r.minAmountOut).toBeLessThanOrEqual(r.expectedOutput);
	});

	it('applies slippage only to final output', () => {
		const r100 = calculateTwoHopSwap(50n, btcHbdPool, hiveHbdPool, 'btc', 'hbd', 'hive', 100);
		const r0 = calculateTwoHopSwap(50n, btcHbdPool, hiveHbdPool, 'btc', 'hbd', 'hive', 0);
		// slippage=0 → minAmountOut == expectedOutput
		expect(r0.minAmountOut).toBe(r0.expectedOutput);
		// slippage=100 (1%) → minAmountOut = expectedOutput * 99%
		expect(r100.minAmountOut).toBe((r100.expectedOutput * 9900n) / 10000n);
	});
});

// ─── calculatePriceImpact ─────────────────────────────────────────────────────
//
// Pool fixtures (from the top of this file):
//   hiveHbdPool: X_HIVE = 2,221,000 units, X_HBD = 2,221,000 units
//   btcHbdPool:  X_BTC  = 3,340 sats,      X_HBD = 3,340,000 units
//
// Hand-computed expected values for each case are shown inline.

describe('calculatePriceImpact', () => {
	it('returns 0 for zero input', () => {
		expect(calculatePriceImpact(0n, 'hive', 'hbd', hiveHbdPool, btcHbdPool)).toBe(0);
	});

	it('returns 0 when pool is null', () => {
		expect(calculatePriceImpact(1_000n, 'hive', 'hbd', null, btcHbdPool)).toBe(0);
		expect(calculatePriceImpact(100n, 'btc', 'hbd', hiveHbdPool, null)).toBe(0);
		expect(calculatePriceImpact(1_000n, 'hive', 'btc', null, btcHbdPool)).toBe(0);
		expect(calculatePriceImpact(1_000n, 'hive', 'btc', hiveHbdPool, null)).toBe(0);
	});

	it('result is always in [0, 100] range', () => {
		const cases: Array<[bigint, string, string]> = [
			[300n,     'hive', 'hbd'],   // tiny HIVE→HBD
			[1_000n,   'hive', 'hbd'],   // 1 HIVE
			[100_000n, 'hive', 'hbd'],   // 100 HIVE
			[1n,       'btc',  'hbd'],   // 1 sat
			[100n,     'btc',  'hbd'],   // 100 sat
			[300n,     'hive', 'btc'],   // tiny HIVE→BTC two-hop
			[100_000n, 'hive', 'btc'],   // 100 HIVE→BTC two-hop
			[50n,      'btc',  'hive'],  // 50 sat→HIVE two-hop
		];
		for (const [x, aIn, aOut] of cases) {
			const pct = calculatePriceImpact(x, aIn, aOut, hiveHbdPool, btcHbdPool);
			expect(pct, `${x} ${aIn}→${aOut}`).toBeGreaterThanOrEqual(0);
			expect(pct, `${x} ${aIn}→${aOut}`).toBeLessThanOrEqual(100);
		}
	});

	// ── HIVE ↔ HBD single-hop ──

	it('tiny HIVE trade ($0.06 ≈ 0.3 HIVE = 300 units) has near-zero impact', () => {
		// impact = 300 / (2,221,000 + 300) = 300 / 2,221,300 ≈ 0.0135%
		const pct = calculatePriceImpact(300n, 'hive', 'hbd', hiveHbdPool, btcHbdPool);
		expect(pct).toBeLessThan(0.05);
		expect(pct).toBeGreaterThanOrEqual(0);
	});

	it('1 HIVE (1,000 units) has near-zero impact', () => {
		// impact = 1,000 / (2,221,000 + 1,000) = 1,000 / 2,222,000 ≈ 0.045%
		const pct = calculatePriceImpact(1_000n, 'hive', 'hbd', hiveHbdPool, btcHbdPool);
		expect(pct).toBeCloseTo(0.045, 2);
	});

	it('100 HIVE (100,000 units) has ~4.3% impact on this pool', () => {
		// impact = 100,000 / (2,221,000 + 100,000) = 100,000 / 2,321,000 ≈ 4.31%
		const pct = calculatePriceImpact(100_000n, 'hive', 'hbd', hiveHbdPool, btcHbdPool);
		expect(pct).toBeCloseTo(4.31, 1);
	});

	it('impact scales proportionally for HBD→HIVE (symmetric pool)', () => {
		// Same pool, symmetric reserves → same impact formula
		const hiveIn = calculatePriceImpact(10_000n, 'hive', 'hbd', hiveHbdPool, btcHbdPool);
		const hbdIn  = calculatePriceImpact(10_000n, 'hbd',  'hive', hiveHbdPool, btcHbdPool);
		expect(hiveIn).toBeCloseTo(hbdIn, 5); // identical since reserves are equal
	});

	// ── BTC ↔ HBD single-hop ──

	it('1 sat BTC→HBD has tiny impact', () => {
		// impact = 1 / (3,340 + 1) = 1 / 3,341 ≈ 0.030%
		const pct = calculatePriceImpact(1n, 'btc', 'hbd', hiveHbdPool, btcHbdPool);
		expect(pct).toBeCloseTo(0.030, 2);
	});

	it('100 sat BTC→HBD reflects shallow pool depth', () => {
		// impact = 100 / (3,340 + 100) = 100 / 3,440 ≈ 2.91%
		// NOTE: this pool has only 3,340 sat of BTC — shallow is expected
		const pct = calculatePriceImpact(100n, 'btc', 'hbd', hiveHbdPool, btcHbdPool);
		expect(pct).toBeCloseTo(2.91, 1);
	});

	it('HBD→BTC: 1,000 mHBD (1.000 HBD) has small impact', () => {
		// impact = 1,000 / (3,340,000 + 1,000) = 1,000 / 3,341,000 ≈ 0.030%
		const pct = calculatePriceImpact(1_000n, 'hbd', 'btc', hiveHbdPool, btcHbdPool);
		expect(pct).toBeCloseTo(0.030, 2);
	});

	// ── BTC ↔ HIVE two-hop ──

	it('tiny HIVE→BTC two-hop (300 units ≈ 0.3 HIVE) shows near-zero impact', () => {
		// hop1: x=300, X_hive=2,221,000 → impact1 = 300/2,221,300 ≈ 0.0135%
		//   hop1Out ≈ 300 * 2,221,000 / 2,221,300 ≈ 299.96 HBD units
		// hop2: x=299.96, X_hbd=3,340,000 → impact2 ≈ 299.96/3,340,299 ≈ 0.00898%
		// combined ≈ 0.0225%
		const pct = calculatePriceImpact(300n, 'hive', 'btc', hiveHbdPool, btcHbdPool);
		expect(pct).toBeLessThan(0.1);
		expect(pct).toBeGreaterThanOrEqual(0);
	});

	it('50 sat BTC→HIVE two-hop has small impact', () => {
		// hop1: x=50, X_btc=3,340 → impact1 = 50/3,390 ≈ 1.475%
		//   hop1Out ≈ 50 * 3,340,000 / 3,390 ≈ 49,261 HBD units
		// hop2: x=49,261, X_hbd=2,221,000 → impact2 = 49,261/2,270,261 ≈ 2.17%
		// combined = 1 - (1-0.01475)*(1-0.0217) ≈ 3.62%
		const pct = calculatePriceImpact(50n, 'btc', 'hive', hiveHbdPool, btcHbdPool);
		expect(pct).toBeGreaterThan(0);
		expect(pct).toBeLessThan(10);
	});

	it('impact increases monotonically with trade size', () => {
		const sizes = [100n, 1_000n, 10_000n, 100_000n];
		let prev = -1;
		for (const x of sizes) {
			const pct = calculatePriceImpact(x, 'hive', 'hbd', hiveHbdPool, btcHbdPool);
			expect(pct).toBeGreaterThan(prev);
			prev = pct;
		}
	});

	it('two-hop impact is higher than either single-hop alone for same input', () => {
		// HIVE→BTC via HBD should have more impact than just HIVE→HBD alone
		const twoHop   = calculatePriceImpact(100_000n, 'hive', 'btc', hiveHbdPool, btcHbdPool);
		const singleH  = calculatePriceImpact(100_000n, 'hive', 'hbd', hiveHbdPool, btcHbdPool);
		expect(twoHop).toBeGreaterThan(singleH);
	});
});
