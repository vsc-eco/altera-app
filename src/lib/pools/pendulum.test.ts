import { describe, it, expect } from 'vitest';
import {
	splitInt,
	calculateSplitPreviewFixed,
	splitFromSBps,
	cliffTimesE,
	mulDivFloor,
	CLIFF_S_BPS,
	classifyZone,
	sBps,
	BAND_EDGES,
	type SplitInputs
} from './pendulum';

// Vectors lifted directly from go-vsc-node
// modules/incentive-pendulum/pendulum_int_test.go — the TS port must match
// the node bit-for-bit.

describe('splitInt — reference vectors from go-vsc-node', () => {
	it('equilibrium s=1.0 splits 600/400 (not cliff)', () => {
		const out = splitInt({ R: 1000n, E: 1000n, T: 1500n, V: 1000n, P: 500n });
		expect(out.ok).toBe(true);
		expect(out.underSecured).toBe(false);
		expect(out.finalNodeShare).toBe(600n);
		expect(out.finalPoolShare).toBe(400n);
	});

	it('exact cliff V = 3E routes 100% to nodes', () => {
		const out = splitInt({ R: 100000n, E: 1000n, T: 4500n, V: 3000n, P: 1500n });
		expect(out.ok).toBe(true);
		expect(out.underSecured).toBe(true);
		expect(out.finalNodeShare).toBe(100000n);
		expect(out.finalPoolShare).toBe(0n);
	});

	it('past cliff s=3.5 routes 100% to nodes', () => {
		const out = splitInt({ R: 100000n, E: 1000n, T: 10500n, V: 3500n, P: 1750n });
		expect(out.ok).toBe(true);
		expect(out.underSecured).toBe(true);
		expect(out.finalNodeShare).toBe(100000n);
		expect(out.finalPoolShare).toBe(0n);
	});

	it('conserves R exactly across assorted inputs (node + pool == R)', () => {
		const cases: SplitInputs[] = [
			{ R: 12345n, E: 100n, T: 150n, V: 40n, P: 25n },
			{ R: 1n, E: 100n, T: 150n, V: 40n, P: 25n },
			{ R: 0n, E: 100n, T: 150n, V: 40n, P: 25n },
			{ R: 999999999999n, E: 100n, T: 150n, V: 40n, P: 25n },
			{ R: 100n, E: 7n, T: 11n, V: 3n, P: 2n }
		];
		for (const c of cases) {
			const out = splitInt(c);
			expect(out.ok).toBe(true);
			expect(out.finalNodeShare + out.finalPoolShare).toBe(c.R);
		}
	});

	it('rejects invalid inputs (E/T ≤ 0, negatives)', () => {
		expect(splitInt({ R: 1000n, E: 0n, T: 1500n, V: 1000n, P: 500n }).ok).toBe(false);
		expect(splitInt({ R: 1000n, E: 1000n, T: 0n, V: 1000n, P: 500n }).ok).toBe(false);
		expect(splitInt({ R: -1n, E: 1000n, T: 1500n, V: 1000n, P: 500n }).ok).toBe(false);
	});

	it('V == 0 routes to nodes without the cliff flag', () => {
		const out = splitInt({ R: 1000n, E: 1000n, T: 1500n, V: 0n, P: 500n });
		expect(out.ok).toBe(true);
		expect(out.underSecured).toBe(false);
		expect(out.finalNodeShare).toBe(1000n);
		expect(out.finalPoolShare).toBe(0n);
	});
});

describe('constants + helpers', () => {
	it('cliff is c = 3.0 (30000 bps)', () => {
		expect(CLIFF_S_BPS).toBe(30000n);
	});

	it('cliffTimesE(E) = 3·E', () => {
		expect(cliffTimesE(1000n)).toBe(3000n);
	});

	it('mulDivFloor floors toward zero and guards divide-by-zero', () => {
		expect(mulDivFloor(1000n, 1000000000n, 2500000000n)).toBe(400n);
		expect(mulDivFloor(7n, 3n, 2n)).toBe(10n); // floor(21/2)
		expect(() => mulDivFloor(1n, 1n, 0n)).toThrow();
	});
});

describe('calculateSplitPreviewFixed', () => {
	it('derives E from the bond ratio and matches the equilibrium split', () => {
		// effNum/effDen = 2/3 → E = 1500·2/3 = 1000, reproducing the go-vsc-node
		// equilibrium vector (R=1000, E=1000, T=1500, V=1000, P=500 → 600/400).
		const p = calculateSplitPreviewFixed(1000n, 1500n, 2n, 3n, 1000n, 500n);
		expect(p.ok).toBe(true);
		expect(p.E).toBe(1000n);
		expect(p.finalNodeShare).toBe(600n);
		expect(p.finalPoolShare).toBe(400n);
		expect(p.nodeShareBps).toBe(6000); // 60%
	});

	it('rejects non-positive inputs', () => {
		expect(calculateSplitPreviewFixed(0n, 1000n, 1n, 1n, 1000n, 500n).ok).toBe(false);
		expect(calculateSplitPreviewFixed(1000n, 1000n, 0n, 1n, 1000n, 500n).ok).toBe(false);
	});
});

describe('collateral zone', () => {
	it('s = V/E in bps', () => {
		expect(sBps(1000n, 1000n)).toBe(10000n); // 1.0
		expect(sBps(1500n, 1000n)).toBe(15000n); // 1.5
	});

	it('equilibrium (s = s_eq = 1.0) lands in the ideal band', () => {
		expect(classifyZone(10000n)).toBe('ideal');
	});

	it('at/above the cliff is under-secured', () => {
		expect(classifyZone(CLIFF_S_BPS)).toBe('under-secured');
		expect(classifyZone(CLIFF_S_BPS + 1n)).toBe('under-secured');
	});

	it('band edges are ordered ideal ⊂ safe ⊂ warn ⊂ extreme', () => {
		const e = BAND_EDGES;
		expect(e.extremeLo < e.warnLo).toBe(true);
		expect(e.warnLo < e.safeLo).toBe(true);
		expect(e.safeLo < e.idealLo).toBe(true);
		expect(e.idealLo < e.idealHi).toBe(true);
		expect(e.idealHi < e.safeHi).toBe(true);
		expect(e.safeHi < e.warnHi).toBe(true);
		expect(e.warnHi < e.extremeHi).toBe(true);
	});
});

describe('splitFromSBps — closed form of s (drives the live UI split)', () => {
	it('equilibrium s=1.0 → 60/40 node/LP', () => {
		expect(splitFromSBps(10000n)).toEqual({ nodeShareBps: 6000n, lpShareBps: 4000n });
	});

	it('s=0.5 (liquidity-starved) tilts to LPs → 37.5/62.5', () => {
		expect(splitFromSBps(5000n)).toEqual({ nodeShareBps: 3750n, lpShareBps: 6250n });
	});

	it('at/above the cliff s=3.0 → 100% nodes', () => {
		expect(splitFromSBps(CLIFF_S_BPS)).toEqual({ nodeShareBps: 10000n, lpShareBps: 0n });
		expect(splitFromSBps(40000n)).toEqual({ nodeShareBps: 10000n, lpShareBps: 0n });
	});

	// The whole point: the closed form must equal SplitInt under the deployed
	// geometry (V = 2P, E = ⅔T i.e. T = 3E/2, c = 3). Construct exact vectors and
	// compare the LP fraction (in bps) both ways.
	it('matches SplitInt exactly under the V=2P, E=⅔T geometry', () => {
		const R = 1_000_000n;
		for (const [E, expectedS] of [
			[1000n, 10000n], // s = V/E = 1.0  (V = 1000)
			[2000n, 5000n], // s = 0.5        (V = 1000)
			[800n, 12500n], // s = 1.25       (V = 1000)
			[500n, 20000n] // s = 2.0         (V = 1000)
		] as const) {
			const V = 1000n;
			const P = V / 2n; // V = 2P
			const T = (3n * E) / 2n; // E = ⅔T  →  T = 3E/2
			const out = splitInt({ R, E, T, V, P });
			expect(out.ok).toBe(true);
			// SplitInt's realized LP fraction in bps
			const lpBpsFromSplit = (out.finalPoolShare * 10000n) / R;
			const { lpShareBps } = splitFromSBps(expectedS);
			// within 1 bps of each other (integer-floor rounding)
			const diff =
				lpBpsFromSplit > lpShareBps ? lpBpsFromSplit - lpShareBps : lpShareBps - lpBpsFromSplit;
			expect(diff <= 1n).toBe(true);
		}
	});
});
