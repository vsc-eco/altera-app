import { describe, expect, it, vi } from 'vitest';

// rcSizing imports the houdini store for `estimateCallRc`; the pure helpers
// under test never touch it.
vi.mock('$houdini', () => ({ SimulateContractCallsStore: class {} }));

import {
	interpretSimulation,
	MAX_RC_LIMIT,
	rcShortfallMessage,
	sizeRcLimit
} from './rcSizing';

describe('sizeRcLimit', () => {
	it('pads the measured cost by 25% when the account can afford it', () => {
		// 80,000-sat mainnet unmap measured at 19,153 RC (2026-10-17 dry run).
		expect(sizeRcLimit(19_153, 40_000)).toEqual({ ok: true, rcLimit: 23_942 });
	});

	it('clamps the padding to the RC the account has', () => {
		// eliel's third try: 20,885 RC available, 19,153 needed. The old fixed
		// 10,000 limit failed it; the padded limit would exceed what he has.
		expect(sizeRcLimit(19_153, 20_885)).toEqual({ ok: true, rcLimit: 20_885 });
	});

	it('reports a shortfall when the measured cost exceeds the RC available', () => {
		expect(sizeRcLimit(19_153, 10_014)).toEqual({
			ok: false,
			reason: 'insufficient-rc',
			needed: 19_153,
			available: 10_014
		});
	});

	it('never exceeds the node maximum, however much RC the account has', () => {
		expect(sizeRcLimit(90_000, 500_000)).toEqual({ ok: true, rcLimit: MAX_RC_LIMIT });
	});

	it('is never below 1 (the node rejects rc_limit 0)', () => {
		expect(sizeRcLimit(0, 10_000)).toEqual({ ok: true, rcLimit: 1 });
	});
});

describe('interpretSimulation', () => {
	it('successful dry run → sized limit', () => {
		expect(interpretSimulation({ success: true, rc_used: 5_624 }, 37_753)).toEqual({
			ok: true,
			rcLimit: 7_030,
			rcUsed: 5_624,
			available: 37_753
		});
	});

	it('gas_limit_hit → not enough RC, exact cost unknown', () => {
		expect(
			interpretSimulation(
				{ success: false, err: 'gas_limit_hit', err_msg: 'cost limit exceeded', rc_used: 10_014 },
				10_014
			)
		).toEqual({ ok: false, reason: 'insufficient-rc', available: 10_014 });
	});

	it('any other failure → the call itself fails; pass the node message through', () => {
		expect(
			interpretSimulation(
				{
					success: false,
					err: 'insufficient_balance',
					err_msg: 'caller balance 0 insufficient for amount+fee 5000',
					rc_used: 555
				},
				10_014
			)
		).toEqual({
			ok: false,
			reason: 'call-fails',
			error: 'caller balance 0 insufficient for amount+fee 5000'
		});
	});
});

describe('rcShortfallMessage', () => {
	it('names the cost, the balance and the HBD to deposit when the cost is known', () => {
		expect(
			rcShortfallMessage(
				{ ok: false, reason: 'insufficient-rc', needed: 19_153, available: 10_014 },
				'withdrawal'
			)
		).toBe(
			'Not enough RC for this withdrawal: it needs 19,153 RC and you have 10,014. ' +
				'Deposit at least 9.14 HBD to Magi to cover it, or try a smaller amount.'
		);
	});

	it('does not invent a cost when the dry run ran out of RC first', () => {
		expect(
			rcShortfallMessage({ ok: false, reason: 'insufficient-rc', available: 10_014 }, 'withdrawal')
		).toBe(
			'Not enough RC for this withdrawal: it needs more than the 10,014 RC you have. ' +
				'Deposit HBD to Magi to raise your RC, or try a smaller amount.'
		);
	});
});
