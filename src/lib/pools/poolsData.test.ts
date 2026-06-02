/**
 * Tests for `mapStateToPoolRow` — specifically the volume calculation.
 *
 * Pre-fix, the app priced `amount_in` as sym0 and `amount_out` as sym1 across
 * all swap directions — for the HIVE-HBD pool that mixed HBD smallest units
 * with HIVE smallest units and inflated USD volume ~9×. The new code
 * (`touched[sym]`) attributes per-asset volume across both directions, and
 * for HBD-paired pools anchors the USD figure to the HBD side (≈ $1, stable)
 * — matching the by-direction table lordbutterfly shared.
 *
 * Fixtures from the live indexer (queried earlier this session):
 *   pool vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp (HBD-HIVE) all-time:
 *     203 HBD→HIVE: amount_in=2,981,455 HBD-smallest, amount_out=45,309,867 HIVE-smallest
 *     447 HIVE→HBD: amount_in=45,854,060 HIVE-smallest, amount_out=2,953,021 HBD-smallest
 *   →  HBD touched = 2,981,455 + 2,953,021 = 5,934,476 (smallest, dec3 → 5,934.48 HBD)
 *      HIVE touched = 45,309,867 + 45,854,060 = 91,163,927 (smallest, dec3 → 91,163.93 HIVE)
 */

import { describe, it, expect } from 'vitest';
import { mapStateToPoolRow } from './poolsData';

function parseUsd(s: string): number {
	return Number.parseFloat(s.replace(/[$,]/g, ''));
}

// Minimal state map — only what mapStateToPoolRow reads:
const HBD_HIVE_STATE = {
	asset0: JSON.stringify({ asset: 'hbd' }),
	asset1: JSON.stringify({ asset: 'hive' }),
	total_lp: '0',
	// Reserves don't matter for volume — pass any non-zero numbers so the
	// price-ratio branch doesn't fall into the USD-derived fallback.
	reserve0: '1000000', // 1000 HBD
	reserve1: '16666667' // ~16,666 HIVE (matches a ~$0.06 HIVE price)
};

const STD_PRICES = { hive: 0.06, hbd: 1.0, btc: 100000 };

describe('mapStateToPoolRow — volume calculation', () => {
	describe('HBD-HIVE pool (HBD-anchored)', () => {
		it('all-time: HBD-touched × $1 = $5,934.48 (matches the by-direction table)', () => {
			const row = mapStateToPoolRow(
				'vsc1pool',
				HBD_HIVE_STATE,
				{
					volume: {
						count: 650,
						touched: { hbd: 5_934_476, hive: 91_163_927 }
					},
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['HBD', 'HIVE']
			);
			expect(parseUsd(row.volumeUsd)).toBeCloseTo(5934.48, 1);
		});

		it('does NOT use the HIVE-priced side (would give $5,469 — stale price-feed dependency)', () => {
			const row = mapStateToPoolRow(
				'vsc1pool',
				HBD_HIVE_STATE,
				{
					volume: { count: 650, touched: { hbd: 5_934_476, hive: 91_163_927 } },
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['HBD', 'HIVE']
			);
			// If we accidentally used the HIVE side, we'd see 91163.927 * 0.06 = 5469.84.
			expect(parseUsd(row.volumeUsd)).not.toBeCloseTo(5469.84, 1);
		});

		it('does NOT use the broken sum (would give ~$51,731 — the ~9× inflation bug)', () => {
			const row = mapStateToPoolRow(
				'vsc1pool',
				HBD_HIVE_STATE,
				{
					volume: { count: 650, touched: { hbd: 5_934_476, hive: 91_163_927 } },
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['HBD', 'HIVE']
			);
			expect(parseUsd(row.volumeUsd)).toBeLessThan(10_000);
		});

		it('per-asset volumeAssets reflect actual smallest-units touched (not the old mixed pair)', () => {
			const row = mapStateToPoolRow(
				'vsc1pool',
				HBD_HIVE_STATE,
				{
					volume: { count: 650, touched: { hbd: 5_934_476, hive: 91_163_927 } },
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['HBD', 'HIVE']
			);
			expect(row.volumeAssets[0]).toMatch(/5,934\.476\s+HBD/);
			expect(row.volumeAssets[1]).toMatch(/91,163\.927\s+HIVE/);
		});

		it('30d window matches lordbutterfly figure ($5,222)', () => {
			// From the by-direction table for 30d:
			//   117 HBD→HIVE: amount_in≈2,634,000 HBD-smallest (= ~$2,634)
			//   361 HIVE→HBD: amount_out≈2,587,000 HBD-smallest (= ~$2,587)
			//   HBD touched ≈ 5,221,000 smallest → 5,221 HBD → $5,221
			// Approximations because the indexer's exact per-direction numbers
			// for 30d weren't captured in this session, but the order matches.
			const row = mapStateToPoolRow(
				'vsc1pool',
				HBD_HIVE_STATE,
				{
					volume: { count: 478, touched: { hbd: 5_221_000, hive: 80_000_000 } },
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['HBD', 'HIVE']
			);
			expect(parseUsd(row.volumeUsd)).toBeCloseTo(5221, 0);
		});
	});

	describe('BTC-HBD pool (HBD-anchored, sym1 case)', () => {
		const BTC_HBD_STATE = {
			asset0: JSON.stringify({ asset: 'btc' }),
			asset1: JSON.stringify({ asset: 'hbd' }),
			total_lp: '0',
			reserve0: '100000', // 0.001 BTC raw at 8 decimals
			reserve1: '100000' // 100 HBD raw at 3 decimals
		};

		it('uses sym1 (HBD) when it appears as the second asset', () => {
			const row = mapStateToPoolRow(
				'vsc1pool',
				BTC_HBD_STATE,
				{
					volume: { count: 10, touched: { btc: 1_000_000, hbd: 100_000 } }, // 0.01 BTC, 100 HBD
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['BTC', 'HBD']
			);
			// HBD-anchored: 100 HBD × $1 = $100 (NOT 0.01 BTC × $100k = $1000)
			expect(parseUsd(row.volumeUsd)).toBeCloseTo(100, 1);
		});
	});

	describe('non-HBD pool (fallback: average of both sides)', () => {
		const HIVE_BTC_STATE = {
			asset0: JSON.stringify({ asset: 'hive' }),
			asset1: JSON.stringify({ asset: 'btc' }),
			total_lp: '0',
			reserve0: '1000000',
			reserve1: '1000'
		};

		it('falls back to average of both sides when neither asset is HBD', () => {
			const row = mapStateToPoolRow(
				'vsc1pool',
				HIVE_BTC_STATE,
				{
					volume: {
						count: 10,
						touched: { hive: 100_000_000, btc: 60_000 } // 100,000 HIVE = $6,000 ; 0.0006 BTC = $60 — symmetry off on purpose
					},
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['HIVE', 'BTC']
			);
			// avg($6,000, $60) = $3,030
			expect(parseUsd(row.volumeUsd)).toBeCloseTo(3030, 0);
		});
	});

	describe('edge: zero / missing touched data', () => {
		it('renders $0.00 when touched is empty', () => {
			const row = mapStateToPoolRow(
				'vsc1pool',
				HBD_HIVE_STATE,
				{
					volume: { count: 0, touched: {} },
					fees: [],
					liquidity: { netAmount0: 0, netAmount1: 0, netLp: 0, snapshot: null }
				},
				STD_PRICES,
				['HBD', 'HIVE']
			);
			expect(parseUsd(row.volumeUsd)).toBe(0);
		});
	});
});
