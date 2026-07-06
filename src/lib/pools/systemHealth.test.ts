import { describe, it, expect } from 'vitest';
import { computeSystemHealth } from './systemHealth';
import type { PoolRow } from './poolsData';
import type { PendulumStat } from '$lib/indexer/poolQueries';

/** Build a PoolRow with only the fields computeSystemHealth reads; rest dummied. */
function poolRow(over: Partial<PoolRow>): PoolRow {
	return {
		id: 'p',
		contractId: 'p',
		pair: 'X:Y',
		pairSymbols: ['X', 'Y'],
		priceRatio: '',
		priceInverse: '',
		rateLabel: '',
		rateLabelInverse: '',
		priceUsd: ['', ''],
		totalLiquidityUsd: '',
		totalLiquidityAssets: ['', ''],
		feeEarnedUsd: '',
		feeBreakdown: [],
		volumeUsd: '',
		volumeAssets: ['', ''],
		reserve0Raw: 0,
		reserve1Raw: 0,
		totalLpRaw: 0,
		decimals0: 3,
		decimals1: 3,
		usdPrice0: 0,
		usdPrice1: 0,
		feeLpUsdNum: 0,
		feeNodeUsdNum: 0,
		feeNetworkUsdNum: 0,
		totalLiquidityUsdNum: 0,
		...over
	};
}

function stat(sBps: number): PendulumStat {
	return { contractId: 'p', sBps, multiplierBps: 10000 };
}

describe('computeSystemHealth', () => {
	// HBD-side reserve = raw/10^dec × price. Pool A: 1,000,000/1e3 × $1 = 1000.
	// Pool B (HBD is side1): 500,000/1e3 × $1 = 500. V = 2 × (1000+500) = 3000.
	const poolA = poolRow({
		id: 'a',
		pair: 'HBD:HIVE',
		pairSymbols: ['HBD', 'HIVE'],
		reserve0Raw: 1_000_000,
		usdPrice0: 1,
		feeNodeUsdNum: 90,
		feeLpUsdNum: 1,
		totalLiquidityUsdNum: 2000
	});
	const poolB = poolRow({
		id: 'b',
		pair: 'BTC:HBD',
		pairSymbols: ['BTC', 'HBD'],
		reserve1Raw: 500_000,
		usdPrice1: 1,
		feeNodeUsdNum: 9,
		feeLpUsdNum: 0,
		totalLiquidityUsdNum: 1000
	});

	it('computes V, T, split, node APR, LP APR and tilt (7d)', () => {
		const h = computeSystemHealth([poolA, poolB], [stat(18000), stat(18000)], '7d');
		const factor = 365 / 7;

		expect(h.s).toBeCloseTo(1.8, 6);
		expect(h.tilt).toBe('nodes'); // s 1.8 > band hi 1.2
		expect(h.vUsd).toBe(3000);
		expect(h.collateralUsd).toBeCloseTo((1.5 * 3000) / 1.8, 6); // 2500
		// split: nodeRev 99, lpRev 1 → 99% / 1%
		expect(h.nodeSharePct).toBeCloseTo(99, 6);
		expect(h.lpSharePct).toBeCloseTo(1, 6);
		// node APR = annualized nodeRev / T
		expect(h.nodeAprPct).toBeCloseTo(((99 * factor) / 2500) * 100, 4);
		// per-pool LP APR = annualized lpFee / TVL
		expect(h.pools.find((p) => p.id === 'a')?.lpAprPct).toBeCloseTo(((1 * factor) / 2000) * 100, 4);
		expect(h.pools.find((p) => p.id === 'b')?.lpAprPct).toBe(0);
		expect(h.annualized).toBe(true);
	});

	it('averages s across differing pendulum rows', () => {
		const h = computeSystemHealth([poolA], [stat(18341), stat(18121)], '7d');
		expect(h.s).toBeCloseTo((1.8341 + 1.8121) / 2, 6);
	});

	it('still reports s/split/V but no APR for the max window with no elapsed span', () => {
		const h = computeSystemHealth([poolA, poolB], [stat(18000)], 'max');
		expect(h.annualized).toBe(false);
		expect(h.windowDays).toBeNull();
		expect(h.nodeAprPct).toBeNull();
		expect(h.pools.every((p) => p.lpAprPct === null)).toBe(true);
		expect(h.nodeSharePct).toBeCloseTo(99, 6); // split still works
		expect(h.vUsd).toBe(3000);
	});

	it('annualizes the max window over its elapsed span when given maxDays', () => {
		const maxDays = 73; // ~2.5 months of history
		const h = computeSystemHealth([poolA, poolB], [stat(18000)], 'max', maxDays);
		const factor = 365 / maxDays;
		expect(h.annualized).toBe(true);
		expect(h.windowDays).toBe(maxDays);
		// same APR formulas as a fixed window, but annualized over maxDays
		expect(h.nodeAprPct).toBeCloseTo(((99 * factor) / 2500) * 100, 4);
		expect(h.pools.find((p) => p.id === 'a')?.lpAprPct).toBeCloseTo(((1 * factor) / 2000) * 100, 4);
	});

	it('degrades gracefully when the pendulum view is absent', () => {
		const h = computeSystemHealth([poolA, poolB], [], '7d');
		expect(h.s).toBeNull();
		expect(h.tilt).toBe('unknown');
		expect(h.collateralUsd).toBeNull();
		expect(h.nodeAprPct).toBeNull();
		// realized split needs no pendulum, so it still computes
		expect(h.nodeSharePct).toBeCloseTo(99, 6);
	});
});
