import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/queryOnce', () => ({ queryOnce: vi.fn() }));

import { parsePayoutGas, payoutArrival, payoutGasLimitFromEstimate } from './payoutFee';

describe('parsePayoutGas', () => {
	it('reads the fee a PAYOUT-1 bridge reports', () => {
		expect(
			parsePayoutGas('{"symbol":"usdc","proof_fee":"150000","payout_gas_fee":"400400"}')
		).toEqual({
			status: 'priced',
			fee: 400400
		});
	});
	it('a bridge without the field is the old one (refund later on Magi)', () => {
		expect(parsePayoutGas('{"symbol":"usdc","proof_fee":"150000"}')).toEqual({ status: 'legacy' });
	});
	it('an empty fee: the bridge cannot price a payout now', () => {
		expect(parsePayoutGas('{"payout_gas_fee":""}')).toEqual({ status: 'unavailable' });
	});
	it('no answer or garbage: unknown', () => {
		expect(parsePayoutGas(undefined)).toEqual({ status: 'unknown' });
		expect(parsePayoutGas('not json')).toEqual({ status: 'unknown' });
	});
});

describe('payoutArrival', () => {
	// The 11-21 mainnet swap at the new fee: min out 3.209774 USDC, proof fee
	// 0.15, gas 0.6604 (65,000 gas at 1.5 x 2.52 gwei + 2 gwei, 1,760 USDC/ETH).
	it('takes the proof fee and the gas from the minimum output', () => {
		const r = payoutArrival(3_209_774, 150_000, { status: 'priced', fee: 660_400 });
		expect(r).toEqual({ sent: 3_059_774, gas: 660_400, arrives: 2_399_374, heavy: true });
	});
	it('is not heavy at a tenth or less', () => {
		expect(payoutArrival(100_150_000, 150_000, { status: 'priced', fee: 660_400 }).heavy).toBe(
			false
		);
	});
	it('says nothing about gas it does not know', () => {
		expect(payoutArrival(3_209_774, 150_000, { status: 'legacy' })).toEqual({
			sent: 3_059_774,
			gas: null,
			arrives: null,
			heavy: false
		});
	});
});

describe('payoutGasLimitFromEstimate', () => {
	it('adds 20% to the estimate', () => {
		expect(payoutGasLimitFromEstimate(21_000n)).toBe(25_200);
		expect(payoutGasLimitFromEstimate(207_000n)).toBe(248_400); // a new account after Glamsterdam
	});
	it('is never below a plain transfer nor above the bridge limit', () => {
		expect(payoutGasLimitFromEstimate(1n)).toBe(21_000);
		// Capped at the bridge's payout limit (MaxPayoutGasLimit): above it the
		// bridge refuses the payout and the whole swap fails.
		expect(payoutGasLimitFromEstimate(5_000_000n)).toBe(300_000);
		expect(payoutGasLimitFromEstimate(260_000n)).toBe(300_000);
		expect(payoutGasLimitFromEstimate(250_000n)).toBe(300_000);
		expect(payoutGasLimitFromEstimate(240_000n)).toBe(288_000);
	});
});
