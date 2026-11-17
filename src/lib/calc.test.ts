/**
 * Tests for `calc.ts` — the one place the app does arithmetic.
 *
 * The swap/AMM quote math keeps its own long-standing suite next door in
 * `pools/swapCalc.test.ts` (82 cases against the on-chain contract), and the
 * chart window keeps `cards/Balance/chartWindow.test.ts`; both now exercise
 * this module through its re-export, which doubles as a drift guard. What
 * follows covers everything that used to be inline in a component or a class
 * method and therefore had no test at all — the unit conversions above all,
 * where a rounding choice is the difference between spending a milli-unit the
 * user did not type and not spending it.
 */

import { describe, it, expect } from 'vitest';
import {
	// §1 units
	unitScale,
	toDisplay,
	toBaseUnits,
	parseAmountToBaseUnits,
	formatBaseUnits,
	rescaleBaseUnits,
	isValidAmountString,
	satsToBtc,
	btcToSats,
	// §2 bps
	bpsToPct,
	pctToBps,
	feeOfBps,
	netAfterBps,
	netAfterBpsBig,
	clampSlippagePct,
	MAX_SLIPPAGE_PCT,
	// §3 money
	formatUsd,
	formatUsdPrice,
	compactCount,
	compactUsd,
	formatAmountWithUnit,
	formatAmountGrouped,
	formatMinFigs,
	dollarsAndCents,
	usdOfBaseUnits,
	// §4 rates
	isFeedUnit,
	nativeRates,
	composeRates,
	hbdPerTokenFromReserves,
	type FeedPrices,
	// §5 swap extras
	constantProductOut,
	effectiveRate,
	protocolFeeUsd,
	impactLevel,
	// §6 pools
	lpShare,
	lpPositionAmounts,
	lpPositionUsd,
	mirrorLiquidityAmount,
	poolPriceRatio,
	impliedPoolUsdPrices,
	poolTvlUsd,
	// §7 rc
	sizeRcLimit,
	btcPayoutSwapRcLimit,
	rcShortfallToHbd,
	maxRc,
	rcPercent,
	MAX_RC_LIMIT,
	BTC_PAYOUT_SWAP_MIN_RC,
	// §8 staking
	hbdAprFromChainRate,
	interestOverPeriod,
	stakingEarnings,
	// §9 charts
	pointerIndex,
	runningTotal,
	percentChange,
	spacedIndexes,
	// §10 btc
	spendableSats,
	feeReserveSats,
	maxSendableSats,
	clampedFeeRate,
	estimateVSize,
	// §11 time
	dateFromBlockHeight,
	blockHeightFromDate,
	secondsRemaining,
	splitDuration,
	// §12 misc
	clamp,
	progressPercent,
	roundToSigFigs,
	backoffDelayMs,
	arcDashOffset,
	netAfterFees
} from './calc';

// ───────────────────────────────────────────────────────────────── §1 units

describe('base units ↔ display', () => {
	it('scales by the asset decimals', () => {
		expect(unitScale(3)).toBe(1000);
		expect(unitScale(8)).toBe(100_000_000);
		expect(unitScale(0)).toBe(1);
	});

	it('converts both directions for HIVE (3 dp) and BTC (8 dp)', () => {
		expect(toDisplay(12345, 3)).toBe(12.345);
		expect(toDisplay(100_000_000, 8)).toBe(1);
		expect(toBaseUnits(12.345, 3)).toBe(12345);
		expect(toBaseUnits(1, 8)).toBe(100_000_000);
	});

	it('accepts a bigint or a numeric string', () => {
		expect(toDisplay(12345n, 3)).toBe(12.345);
		expect(toDisplay('12345', 3)).toBe(12.345);
	});

	it('yields 0 rather than NaN for junk — a NaN here printed "$NaN" over a funded wallet', () => {
		expect(toDisplay(undefined, 3)).toBe(0);
		expect(toDisplay(null, 3)).toBe(0);
		expect(toDisplay('abc', 3)).toBe(0);
		expect(toBaseUnits(Number.NaN, 3)).toBe(0);
	});

	it('rounds rather than truncates, so a float artefact cannot eat a milli-unit', () => {
		// 0.1 + 0.2 === 0.30000000000000004
		expect(toBaseUnits(0.1 + 0.2, 3)).toBe(300);
		expect(toBaseUnits(0.0005, 3)).toBe(1);
	});
});

describe('parseAmountToBaseUnits', () => {
	it('parses the digits instead of multiplying a float', () => {
		// Number('0.07') * 1000 === 70.00000000000001
		expect(parseAmountToBaseUnits('0.07', 3)).toBe(70);
		expect(parseAmountToBaseUnits('1.23', 3)).toBe(1230);
		expect(parseAmountToBaseUnits('12', 3)).toBe(12000);
	});

	it('TRUNCATES precision the asset does not have, never rounds it up', () => {
		// The string came from a text field: rounding 0.1239 up to 0.124 would
		// spend a milli-unit the user never typed.
		expect(parseAmountToBaseUnits('0.1239', 3)).toBe(123);
		expect(parseAmountToBaseUnits('0.9999', 3)).toBe(999);
	});

	it('handles empty, bare integers, leading dot and a sign', () => {
		expect(parseAmountToBaseUnits('', 3)).toBe(0);
		expect(parseAmountToBaseUnits('.5', 3)).toBe(500);
		expect(parseAmountToBaseUnits('-1.5', 3)).toBe(-1500);
		expect(parseAmountToBaseUnits('0', 8)).toBe(0);
	});

	it('falls back to float parsing for exponent form rather than returning 0', () => {
		expect(parseAmountToBaseUnits('1e-3', 3)).toBe(1);
	});

	it('agrees with the old CoinAmount string path on sats (0 dp)', () => {
		expect(parseAmountToBaseUnits('1234', 0)).toBe(1234);
		expect(parseAmountToBaseUnits('1234.9', 0)).toBe(1234);
	});
});

describe('formatBaseUnits', () => {
	it('strips trailing zeroes by default and keeps them on request', () => {
		expect(formatBaseUnits(12300, 3)).toBe('12.3');
		expect(formatBaseUnits(12300, 3, true)).toBe('12.300');
		expect(formatBaseUnits(12000, 3)).toBe('12');
	});

	it('renders zero as "0", and as "0.000" when zeroes are kept', () => {
		expect(formatBaseUnits(0, 3)).toBe('0');
		expect(formatBaseUnits(0, 3, true)).toBe('0.000');
	});

	it('never emits a trailing dot for a zero-decimal asset', () => {
		expect(formatBaseUnits(1234, 0)).toBe('1234');
		expect(formatBaseUnits(1234, 0, true)).toBe('1234');
	});

	it('keeps the sign and pads amounts below one unit', () => {
		expect(formatBaseUnits(-12345, 3)).toBe('-12.345');
		expect(formatBaseUnits(5, 3)).toBe('0.005');
		expect(formatBaseUnits(-5, 3)).toBe('-0.005');
	});

	it('round-trips with parseAmountToBaseUnits', () => {
		for (const s of ['0.001', '1.5', '1234.567', '0.1']) {
			expect(formatBaseUnits(parseAmountToBaseUnits(s, 3), 3)).toBe(
				Number(s).toString()
			);
		}
	});
});

describe('rescaleBaseUnits', () => {
	it('crosses decimal places as well as applying the rate', () => {
		// 1 BTC (8 dp) at 90,000 HBD/BTC → 90,000,000 milli-HBD (3 dp)
		expect(rescaleBaseUnits(100_000_000, 90_000, 8, 3)).toBe(90_000_000);
		// and back
		expect(rescaleBaseUnits(90_000_000, 1 / 90_000, 3, 8)).toBe(100_000_000);
	});

	it('is identity at rate 1 with equal decimals', () => {
		expect(rescaleBaseUnits(12345, 1, 3, 3)).toBe(12345);
	});

	it('yields 0 for non-finite input rather than NaN', () => {
		expect(rescaleBaseUnits(Number.NaN, 2, 3, 3)).toBe(0);
		expect(rescaleBaseUnits(100, Number.NaN, 3, 3)).toBe(0);
	});
});

describe('isValidAmountString', () => {
	it('rejects empty, zero, negative, junk and Infinity', () => {
		for (const v of ['', null, undefined, '0', '-1', 'abc', 'NaN', 'Infinity']) {
			expect(isValidAmountString(v)).toBe(false);
		}
	});
	it('accepts positive amounts', () => {
		for (const v of ['1', '1.23', '0.0001', '1e-3', ' 1 ']) {
			expect(isValidAmountString(v)).toBe(true);
		}
	});
});

describe('sats ↔ BTC', () => {
	it('converts both ways', () => {
		expect(satsToBtc(100_000_000)).toBe(1);
		expect(btcToSats(1)).toBe(100_000_000);
		// A fractional sat does not exist; 0.000000015 BTC is 1.4999…e0 sats in
		// binary floating point, so it rounds down to 1.
		expect(btcToSats(0.000_000_015)).toBe(1);
		expect(btcToSats(0.000_000_016)).toBe(2);
	});
});

// ─────────────────────────────────────────────────────────────────── §2 bps

describe('basis points', () => {
	it('converts to and from percent', () => {
		expect(bpsToPct(25)).toBe(0.25);
		expect(pctToBps(0.25)).toBe(25);
		expect(pctToBps(0.5)).toBe(50);
		expect(pctToBps(1)).toBe(100);
	});

	it('takes and leaves the right slice, flooring like the contract', () => {
		expect(feeOfBps(10_000, 25)).toBe(25);
		expect(netAfterBps(10_000, 25)).toBe(9975);
		// floor, not round: 999 * 25 / 10000 = 2.4975
		expect(feeOfBps(999, 25)).toBe(2);
		expect(netAfterBps(999, 25)).toBe(996);
	});

	it('fee + net never exceeds the gross', () => {
		for (const amt of [1, 7, 999, 123_456]) {
			expect(feeOfBps(amt, 25) + netAfterBps(amt, 25)).toBeLessThanOrEqual(amt);
		}
	});

	it('is a no-op at 0 bps and safe on junk', () => {
		expect(feeOfBps(1000, 0)).toBe(0);
		expect(netAfterBps(1000, 0)).toBe(1000);
		expect(netAfterBps(-5, 25)).toBe(0);
		expect(feeOfBps(Number.NaN, 25)).toBe(0);
	});

	it('has an exact bigint form for on-chain amounts', () => {
		expect(netAfterBpsBig(10_000n, 25)).toBe(9975n);
		expect(netAfterBpsBig(0n, 25)).toBe(0n);
		expect(netAfterBpsBig(1234n, 0)).toBe(1234n);
	});

	it('clamps a typed slippage into the range the form offers', () => {
		expect(clampSlippagePct(0)).toBe(0.01);
		// 99.99% is consent to receive almost nothing, not a tolerance (M3).
		expect(clampSlippagePct(150)).toBe(MAX_SLIPPAGE_PCT);
		expect(clampSlippagePct(75)).toBe(MAX_SLIPPAGE_PCT);
		expect(clampSlippagePct(49)).toBe(49);
		expect(clampSlippagePct(0.5)).toBe(0.5);
		expect(clampSlippagePct(Number.NaN)).toBe(0.01);
	});
});

// ───────────────────────────────────────────────────────────────── §3 money

describe('dollar formatting', () => {
	it('formatUsd always shows cents and never NaN', () => {
		expect(formatUsd(1234.5)).toBe('$1,234.50');
		expect(formatUsd(0)).toBe('$0.00');
		expect(formatUsd(null)).toBe('$0.00');
		expect(formatUsd(Number.NaN)).toBe('$0.00');
	});

	it('formatUsd shows a sub-cent value as $0.00, by design', () => {
		expect(formatUsd(0.0007)).toBe('$0.00');
	});

	it('formatUsdPrice keeps sub-cent PRICES readable instead', () => {
		// A custom token at $0.0007 would otherwise make its whole column
		// read as worthless.
		expect(formatUsdPrice(0.0007)).toBe('$0.0007');
		expect(formatUsdPrice(1.5)).toBe('$1.50');
		expect(formatUsdPrice(0)).toBe('$0.00');
	});

	it('compactUsd collapses magnitudes for an axis gutter', () => {
		expect(compactUsd(1_500_000)).toBe('$1.5M');
		expect(compactUsd(1500)).toBe('$1.5K');
		expect(compactUsd(12_000)).toBe('$12K');
		expect(compactUsd(0)).toBe('$0');
		expect(compactUsd(-1500)).toBe('-$1.5K');
	});

	it('compactCount keeps the digit a resource-credit figure is read for', () => {
		// 13,463 RC must not collapse to "13K" — the tenths are the whole point
		// of showing the number in a chip this small.
		expect(compactCount(13_463)).toBe('13.5K');
		expect(compactCount(1500)).toBe('1.5K');
		// Past 100K the tenth is noise, so it goes.
		expect(compactCount(250_400)).toBe('250K');
		expect(compactCount(1_500_000)).toBe('1.5M');
		// Below a thousand nothing is gained by collapsing.
		expect(compactCount(999)).toBe('999');
		expect(compactCount(0)).toBe('0');
		expect(compactCount(-1500)).toBe('-1.5K');
		expect(compactCount(Number.NaN)).toBe('0');
	});

	it('compactUsd keeps two significant digits below a dollar', () => {
		// Ticks reading "$0.00, $0.00, $0.00" are worse than no axis.
		expect(compactUsd(0.0042)).toBe('$0.0042');
	});

	it('formats an amount with its unit and at the asset precision', () => {
		expect(formatAmountWithUnit(1234.5, 'hive', 3)).toBe('1,234.500 HIVE');
		expect(formatAmountWithUnit(1234.5, '$', 2)).toBe('$1,234.50');
		expect(formatAmountGrouped(1234.5, 3)).toBe('1,234.500');
	});

	it('formatMinFigs keeps a small amount from reading as zero', () => {
		expect(formatMinFigs(0.00012345, 8)).not.toMatch(/^0\.000$/);
		// Intl gives significant digits priority over fraction digits when both
		// are set, so 4 sig figs wins here — same as the old CoinAmount.toMinFigs.
		expect(formatMinFigs(1234.5, 3)).toBe('1,234.5');
		expect(formatMinFigs(-1.5, 3)).toMatch(/^-1\.5/);
	});

	it('splits dollars and cents AFTER rounding, so the carry lands', () => {
		// Splitting first renders 999.999 as "$999" + ".100".
		expect(dollarsAndCents(999.999)).toEqual({ dollars: '1,000', cents: '00' });
		expect(dollarsAndCents(12.3)).toEqual({ dollars: '12', cents: '30' });
		expect(dollarsAndCents(0)).toEqual({ dollars: '0', cents: '00' });
		expect(dollarsAndCents(-5.25)).toEqual({ dollars: '-5', cents: '25' });
	});

	it('values an on-chain amount in dollars', () => {
		expect(usdOfBaseUnits(12_345, 3, 2)).toBeCloseTo(24.69, 6);
		expect(usdOfBaseUnits(100_000_000, 8, 90_000)).toBe(90_000);
		expect(usdOfBaseUnits(null, 3, 2)).toBe(0);
		expect(usdOfBaseUnits(1000, 3, Number.NaN)).toBe(0);
	});
});

// ───────────────────────────────────────────────────────────────── §4 rates

const PRICES: FeedPrices = {
	hiveHbd: 0.25,
	hiveUsd: 0.25,
	hiveBtc: 0.000_003,
	satsHive: 300,
	hbdUsd: 1,
	hbdBtc: 0.000_012,
	satsHbd: 1200,
	btcUsd: 90_000
};

describe('exchange rates', () => {
	it('knows which units the feed quotes', () => {
		expect(isFeedUnit('hive')).toBe(true);
		expect(isFeedUnit('BTC')).toBe(true);
		expect(isFeedUnit('LASSECASH')).toBe(false);
		expect(isFeedUnit(undefined)).toBe(false);
	});

	it('builds a native table whose self-rate is 1', () => {
		for (const u of ['HIVE', 'HBD', 'USD', 'BTC', 'SATS']) {
			expect(nativeRates(u, PRICES)![u]).toBe(1);
		}
		expect(nativeRates('LASSECASH', PRICES)).toBeNull();
	});

	it('inverts consistently between HIVE and HBD', () => {
		const hive = nativeRates('HIVE', PRICES)!;
		const hbd = nativeRates('HBD', PRICES)!;
		expect(hive.HBD * hbd.HIVE).toBeCloseTo(1, 10);
	});

	it('composes a custom token through HBD in both directions', () => {
		const tokens = { LASSECASH: 0.0007 }; // HBD per token
		const fromHbd = composeRates('HBD', PRICES, tokens)!;
		// 1 HBD buys 1/0.0007 LASSECASH
		expect(fromHbd.LASSECASH).toBeCloseTo(1 / 0.0007, 6);

		const fromToken = composeRates('LASSECASH', PRICES, tokens)!;
		expect(fromToken.HBD).toBeCloseTo(0.0007, 10);
		expect(fromToken.LASSECASH).toBe(1);
		// round trip
		expect(fromHbd.LASSECASH * fromToken.HBD).toBeCloseTo(1, 10);
	});

	it('routes token → token through HBD', () => {
		const tokens = { AAA: 0.002, BBB: 0.0005 };
		const fromA = composeRates('AAA', PRICES, tokens)!;
		expect(fromA.BBB).toBeCloseTo(0.002 / 0.0005, 10);
	});

	it('returns null for a token with no pool, rather than NaN rates', () => {
		expect(composeRates('NOPOOL', PRICES, {})).toBeNull();
		expect(composeRates('EMPTY', PRICES, { EMPTY: 0 })).toBeNull();
	});

	it('prices a token from its pool reserves across differing decimals', () => {
		// 1,000,000 TOKEN (8 dp) against 700 HBD (3 dp) → 0.0007 HBD/token
		expect(hbdPerTokenFromReserves(100_000_000_000_000, 8, 700_000, 3)).toBeCloseTo(
			0.0007,
			10
		);
		expect(hbdPerTokenFromReserves(0, 8, 700_000, 3)).toBe(0);
	});
});

// ──────────────────────────────────────────────────────────────── §5 swap

describe('swap readouts', () => {
	it('computes the pre-fee constant-product output', () => {
		// x = 1000 into X = Y = 1_000_000: floor(1e12 / 1_001_000) = 999_000,
		// so 1_000_000 - 999_000 = 1000 out before fees.
		expect(constantProductOut(1000n, 1_000_000n, 1_000_000n)).toBe(1000n);
		expect(constantProductOut(0n, 1n, 1n)).toBe(0n);
		expect(constantProductOut(1n, 0n, 1n)).toBe(0n);
	});

	it('derives the effective rate across differing decimals', () => {
		// 1 BTC in (8 dp) → 90,000,000 milli-HBD out (3 dp) = 90,000 HBD/BTC
		expect(effectiveRate(100_000_000, 90_000_000, 8, 3)).toBe(90_000);
		expect(effectiveRate(0, 1, 8, 3)).toBe(0);
	});

	it('sums both hops of a two-hop protocol fee in USD', () => {
		const result = {
			baseFee: 1000n, // 1 HIVE at 3 dp
			hop1Fee: { asset: 'hbd', baseFee: 2000n, clpFee: 0n, totalFee: 2000n }
		};
		// 1 HIVE at $0.25 + 2 HBD at $1
		expect(protocolFeeUsd(result, 3, 0.25, 3, 1)).toBeCloseTo(0.25 + 2, 10);
		// without the hop1 prices, only the final leg counts
		expect(protocolFeeUsd(result, 3, 0.25)).toBeCloseTo(0.25, 10);
		expect(protocolFeeUsd(null, 3, 1)).toBe(0);
	});

	it('bands the price impact for the warning', () => {
		expect(impactLevel(0)).toBe('none');
		expect(impactLevel(0.4)).toBe('low');
		expect(impactLevel(2)).toBe('medium');
		expect(impactLevel(4)).toBe('high');
		expect(impactLevel(9)).toBe('severe');
	});
});

// ──────────────────────────────────────────────────────────────── §6 pools

describe('pool and LP math', () => {
	it('computes a share and the amounts it is worth', () => {
		expect(lpShare(250, 1000)).toBe(0.25);
		expect(lpShare(250, 0)).toBe(0); // an empty pool is 0, not Infinity
		const amounts = lpPositionAmounts(0.25, 4_000_000, 400_000_000, 3, 8);
		expect(amounts).toEqual([1000, 1]);
		expect(lpPositionUsd(amounts, 1, 90_000)).toBe(1000 + 90_000);
	});

	it('mirrors a liquidity add at the pool ratio', () => {
		// pool holds 1000 HBD against 250 HIVE → 1 HBD mirrors to 0.25 HIVE
		expect(mirrorLiquidityAmount(1, 1000, 250)).toBeCloseTo(0.25, 10);
	});

	it('falls back to the USD prices when the pool is empty — that sets the opening price', () => {
		expect(mirrorLiquidityAmount(10, 0, 0, 1, 0.25)).toBeCloseTo(40, 10);
		expect(mirrorLiquidityAmount(10, 0, 0)).toBe(0);
		expect(mirrorLiquidityAmount(0, 1000, 250)).toBe(0);
	});

	it('gives a price ratio from reserves, or from prices when there are none', () => {
		expect(poolPriceRatio(250, 1000)).toEqual({ ratio: 4, inverse: 0.25 });
		expect(poolPriceRatio(null, null, 1, 0.25)).toEqual({ ratio: 4, inverse: 0.25 });
		expect(poolPriceRatio(null, null)).toEqual({ ratio: null, inverse: null });
		expect(poolPriceRatio(0, 1000)).toEqual({ ratio: null, inverse: null });
	});

	it('prices the unquoted side of a pool from the quoted one', () => {
		// 1,000,000 TOKEN against 700 HBD at $1 → $0.0007 per token
		expect(impliedPoolUsdPrices(0, 1, 1_000_000, 700)[0]).toBeCloseTo(0.0007, 10);
		expect(impliedPoolUsdPrices(1, 0, 700, 1_000_000)[1]).toBeCloseTo(0.0007, 10);
		// both already priced → untouched
		expect(impliedPoolUsdPrices(1, 2, 10, 10)).toEqual([1, 2]);
		// empty pool → untouched rather than Infinity
		expect(impliedPoolUsdPrices(0, 1, 0, 700)).toEqual([0, 1]);
	});

	it('adds both sides for TVL', () => {
		expect(poolTvlUsd(1000, 1, 1, 90_000)).toBe(91_000);
	});
});

// ───────────────────────────────────────────────────────────────────── §7 RC

describe('resource credits', () => {
	it('pads a measured cost by the margin', () => {
		expect(sizeRcLimit(1000, 50_000)).toEqual({ ok: true, rcLimit: 1250 });
	});

	it('caps at what the account has and at the node maximum', () => {
		expect(sizeRcLimit(1000, 1100)).toEqual({ ok: true, rcLimit: 1100 });
		expect(sizeRcLimit(90_000, 1_000_000)).toEqual({ ok: true, rcLimit: MAX_RC_LIMIT });
	});

	it('reports a shortfall instead of broadcasting a sure failure', () => {
		const r = sizeRcLimit(5000, 1000);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.needed).toBe(5000);
			expect(r.available).toBe(1000);
		}
	});

	it('leaves an HBD swap input spendable when sizing a BTC payout', () => {
		// The node reserves (rc_limit − free RC) of the caller's HBD before an
		// HBD intent pull, so the limit must not eat the input.
		expect(btcPayoutSwapRcLimit(50_000, 20_000)).toEqual({ ok: true, rcLimit: 30_000 });
		const short = btcPayoutSwapRcLimit(15_000, 10_000);
		expect(short.ok).toBe(false);
		if (!short.ok) expect(short.needed).toBe(BTC_PAYOUT_SWAP_MIN_RC);
	});

	it('converts an RC shortfall into the HBD deposit that covers it', () => {
		// RC is milli-HBD, so 1000 RC short is 1.00 HBD, rounded up to the cent.
		expect(rcShortfallToHbd(2000, 1000)).toBe(1);
		expect(rcShortfallToHbd(1001, 1000)).toBe(0.01);
		expect(rcShortfallToHbd(500, 1000)).toBe(0);
	});

	it('adds the free allowance only for a Hive account', () => {
		expect(maxRc(5000, true)).toBe(15_000);
		expect(maxRc(5000, false)).toBe(5000);
	});

	it('floors the percentage and never reads 100 while short', () => {
		expect(rcPercent(7500, 10_000)).toBe(75);
		expect(rcPercent(9999, 10_000)).toBe(99);
		expect(rcPercent(-5, 10_000)).toBe(0);
		expect(rcPercent(100, 0)).toBe(0);
		expect(rcPercent(20_000, 10_000)).toBe(100);
	});
});

// ─────────────────────────────────────────────────────────────── §8 staking

describe('staking and interest', () => {
	it('converts the chain rate from bps to whole percent', () => {
		expect(hbdAprFromChainRate(1200)).toBe(12);
		expect(hbdAprFromChainRate(1550)).toBe(16);
		expect(hbdAprFromChainRate(null)).toBe(12);
		expect(hbdAprFromChainRate(undefined, 20)).toBe(20);
	});

	it('accrues simple interest over a period', () => {
		expect(interestOverPeriod(36_500, 10, 365)).toBeCloseTo(10, 10);
		expect(interestOverPeriod(1200, 10, 12)).toBeCloseTo(10, 10);
		expect(interestOverPeriod(1000, 10, 0)).toBe(0);
	});

	it('reports daily, monthly and yearly together and they are consistent', () => {
		const e = stakingEarnings(1200, 12);
		expect(e.yearly).toBeCloseTo(144, 10);
		expect(e.monthly).toBeCloseTo(12, 10);
		expect(e.daily * 365).toBeCloseTo(e.yearly, 10);
	});

	it('is zero at a zero balance or a missing APR', () => {
		expect(stakingEarnings(0, 12).daily).toBe(0);
		expect(stakingEarnings(1000, 0).daily).toBe(0);
	});
});

// ──────────────────────────────────────────────────────────────── §9 charts

describe('chart math', () => {
	it('maps a pointer onto the nearest point and clamps at both ends', () => {
		expect(pointerIndex(100, 0, 0, 10, 20)).toBe(10);
		expect(pointerIndex(-50, 0, 0, 10, 20)).toBe(0);
		expect(pointerIndex(9999, 0, 0, 10, 20)).toBe(20);
		expect(pointerIndex(100, 0, 0, 10, -1)).toBeNull();
	});

	it('subtracts the left gutter — a `+` here put the crosshair right of the pointer', () => {
		expect(pointerIndex(100, 0, 40, 10, 20)).toBe(6);
	});

	it('replays a balance from signed deltas', () => {
		expect(runningTotal([5, -2, 10])).toEqual([5, 3, 13]);
		expect(runningTotal([])).toEqual([]);
		expect(runningTotal([1, Number.NaN, 1])).toEqual([1, 1, 2]);
	});

	it('computes percentage change, and 0 from a zero base', () => {
		expect(percentChange(100, 150)).toBe(50);
		expect(percentChange(100, 50)).toBe(-50);
		expect(percentChange(0, 50)).toBe(0);
	});

	it('spaces axis ticks half a step in from each end', () => {
		expect(spacedIndexes(100, 4)).toEqual([12, 37, 62, 87]);
		expect(spacedIndexes(0, 4)).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────────── §10 BTC

describe('bitcoin fees and spendable', () => {
	it('excludes coins a pending payment already spends', () => {
		expect(spendableSats(100_000, 30_000)).toBe(70_000);
		expect(spendableSats(10_000, 30_000)).toBe(0);
	});

	it('holds back a fee reserve and never offers the whole balance', () => {
		expect(feeReserveSats(10)).toBe(2000);
		expect(maxSendableSats(100_000, feeReserveSats(10))).toBe(98_000);
		expect(maxSendableSats(1000, 2000)).toBe(0);
	});

	it('clamps a fee rate into what the node accepts', () => {
		expect(clampedFeeRate(0)).toBe(1);
		expect(clampedFeeRate(5000)).toBe(1000);
		expect(clampedFeeRate(12.4)).toBe(12);
		expect(clampedFeeRate(Number.NaN)).toBe(1);
	});

	it('estimates a segwit virtual size', () => {
		expect(estimateVSize(100, 200)).toBe(Math.floor((100 * 3 + 200 + 3) / 4) + 2);
	});
});

// ─────────────────────────────────────────────────────────────────── §11 time

describe('block heights and time', () => {
	const SYNC_HEIGHT = 88_079_516;
	const SYNC_MS = Date.UTC(2024, 7, 16, 2, 46, 48);

	it('converts a height to a time and back', () => {
		const later = dateFromBlockHeight(SYNC_HEIGHT + 1000, SYNC_HEIGHT, SYNC_MS);
		expect(later - SYNC_MS).toBe(3000 * 1000);
		expect(blockHeightFromDate(later, SYNC_HEIGHT, SYNC_MS)).toBe(SYNC_HEIGHT + 1000);
	});

	it('handles a height before the reference point', () => {
		const earlier = dateFromBlockHeight(SYNC_HEIGHT - 100, SYNC_HEIGHT, SYNC_MS);
		expect(earlier).toBe(SYNC_MS - 300_000);
	});

	it('counts down without going negative, and splits the remainder', () => {
		expect(secondsRemaining(1000, 2000)).toBe(0);
		expect(secondsRemaining(10_000, 0)).toBe(10);
		expect(splitDuration(90_061)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
		expect(splitDuration(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
	});
});

// ─────────────────────────────────────────────────────────────────── §12 misc

describe('small helpers', () => {
	it('clamps', () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-5, 0, 10)).toBe(0);
		expect(clamp(50, 0, 10)).toBe(10);
		expect(clamp(Number.NaN, 2, 10)).toBe(2);
	});

	it('floors a progress percentage', () => {
		expect(progressPercent(5, 10)).toBe(50);
		expect(progressPercent(9.99, 10)).toBe(99);
		expect(progressPercent(5, 0)).toBe(0);
	});

	it('rounds to significant figures', () => {
		expect(roundToSigFigs(1234.5, 4)).toBe(1235);
		expect(roundToSigFigs(0.00012345, 2)).toBeCloseTo(0.00012, 10);
		expect(roundToSigFigs(0, 4)).toBe(0);
	});

	it('doubles the retry delay each attempt', () => {
		expect(backoffDelayMs(0)).toBe(1000);
		expect(backoffDelayMs(1)).toBe(2000);
		expect(backoffDelayMs(2)).toBe(4000);
	});

	it('draws the right arc for a progress ring', () => {
		const r = 40;
		const c = 2 * Math.PI * r;
		expect(arcDashOffset(100, r)).toBeCloseTo(0, 10);
		expect(arcDashOffset(0, r)).toBeCloseTo(c, 10);
		expect(arcDashOffset(50, r)).toBeCloseTo(c / 2, 10);
	});

	it('nets out any number of fees and never goes below zero', () => {
		expect(netAfterFees(1000, 10, 20)).toBe(970);
		expect(netAfterFees(1000, undefined, 20)).toBe(980);
		expect(netAfterFees(10, 50)).toBe(0);
	});
});
