import { describe, expect, it } from 'vitest';
import {
	ALTERA_FEE_ACTIVE,
	ALTERA_FEE_BPS,
	alteraFeePct,
	applyAlteraFee,
	applyAlteraFeeBig,
	swapPaysAlteraFee
} from './swap';

/**
 * The policy (owner, 2026-11-17): 0.25% on EVERY swap, whatever the assets and
 * wherever the output goes, kept on Magi included. No minimum, no cap. Charged
 * once per swap even on a two-hop route.
 *
 * These pin the rule itself. Before this, five places each held their own
 * version: the transaction charged only when the output LEFT Magi and never
 * for HIVE/HBD output, while the card showed 0.25% only for BTC output and
 * "Free" for BTC→HIVE/HBD.
 */
describe('the Altera fee rule', () => {
	it('is one rule with no inputs — every swap pays while active', () => {
		expect(swapPaysAlteraFee()).toBe(ALTERA_FEE_ACTIVE);
	});

	it('is 25 bps', () => {
		expect(ALTERA_FEE_BPS).toBe(25);
	});

	it('reports the percentage the card shows', () => {
		expect(alteraFeePct()).toBe(ALTERA_FEE_ACTIVE ? 0.25 : 0);
	});

	describe('applying it to an amount', () => {
		/**
		 * The arithmetic is UNCONDITIONAL; `swapPaysAlteraFee()` is what decides.
		 * They were one function at first and it broke `buildRouterInstruction`,
		 * which is TOLD whether the fee applies as a parameter — re-reading the
		 * global switch inside meant it silently stopped scaling for it.
		 */
		it('always takes the fee off, leaving the decision to the caller', () => {
			// 1_000_000 - 0.25% = 997_500
			expect(applyAlteraFee(1_000_000)).toBe(997_500);
			expect(applyAlteraFeeBig(1_000_000n)).toBe(997_500n);
		});

		it('agrees between the number and bigint forms', () => {
			for (const v of [1, 999, 1_000, 123_456, 70_426, 50_000_000]) {
				expect(BigInt(applyAlteraFee(v))).toBe(applyAlteraFeeBig(BigInt(v)));
			}
		});

		it('never returns more than it was given, and never goes negative', () => {
			for (const v of [0, 1, 7, 100, 999_999]) {
				expect(applyAlteraFee(v)).toBeLessThanOrEqual(v);
				expect(applyAlteraFee(v)).toBeGreaterThanOrEqual(0);
			}
		});

		/**
		 * ONCE per swap, not once per hop. The contract is what guarantees it —
		 * the router passes `beneficiary`/`ref_bps` on the second hop only, and
		 * the pool takes `ref_bps` from the swap's FINAL output. So the client
		 * must reduce a figure exactly once too: applying it per hop would
		 * under-quote a two-hop route by a second 25 bps.
		 */
		it('applied once is not the same as applied twice', () => {
			const once = applyAlteraFeeBig(1_000_000n);
			const twice = applyAlteraFeeBig(applyAlteraFeeBig(1_000_000n));
			expect(once).toBe(997_500n);
			expect(twice).toBe(995_006n);
			expect(twice).toBeLessThan(once);
		});
	});

	/** No threshold survives: the old rule skipped swaps under a USD value,
	 *  which meant a price-feed failure silently meant no fee. */
	/**
	 * No threshold and no cap: the old rule skipped swaps under a USD value,
	 * which also meant a price-feed failure silently meant no fee.
	 *
	 * The rate is 25 bps of the amount, FLOORED to whole base units. On a tiny
	 * amount the floor rounds the effective rate UP — 1,000 units pays 3, not
	 * 2.5, so 0.3% — which is the same integer-floor behaviour the pool fees
	 * have (review L3). It converges on 0.25% as the amount grows.
	 */
	it('charges 25 bps at any size, floored to whole units', () => {
		for (const v of [1_000n, 70_426n, 50_000_000n, 100_000_000_000n]) {
			expect(applyAlteraFeeBig(v)).toBe((v * 9975n) / 10000n);
		}
		const rate = (v: bigint) => Number(v - applyAlteraFeeBig(v)) / Number(v);
		// Small amounts round up; large ones sit on the nominal rate.
		expect(rate(1_000n)).toBeCloseTo(0.003, 4);
		expect(rate(100_000_000_000n)).toBeCloseTo(0.0025, 6);
		expect(rate(1_000n)).toBeGreaterThanOrEqual(rate(100_000_000_000n));
	});
});
