import { describe, expect, it } from 'vitest';
import { pickSwapRefund, type ContractOutputDag, type OutputRef } from './failureReason';

// F9: a Hive-paid swap the router could not run confirms with
// ret {"amount_out":"0","refunded":...}; the row must show it as refunded.
const tx = 'bafyswaptx';
const refundRet = '{"amount_out":"0","refunded":"2000","asset":"hbd","to":"hive:alice"}';

function out(results: ContractOutputDag['results'], inputs: string[], index?: number[]) {
	const ref: OutputRef = { id: 'bafyout', index };
	return [{ ref, dag: { results, inputs } as ContractOutputDag }];
}

describe('pickSwapRefund', () => {
	it("reads the router's refund from the swap's own result", () => {
		expect(pickSwapRefund(out([{ ok: true, ret: refundRet }], [tx]), tx, 0)).toEqual({
			amount: '2000',
			asset: 'hbd',
			to: 'hive:alice'
		});
	});

	it('a swap that ran is not a refund', () => {
		const ran = '{"amount_out":"4514","asset_out":"hbd"}';
		expect(pickSwapRefund(out([{ ok: true, ret: ran }], [tx]), tx, 0)).toBeNull();
		expect(pickSwapRefund(out([{ ok: true, ret: '{"refunded":"0"}' }], [tx]), tx, 0)).toBeNull();
		expect(pickSwapRefund(out([{ ok: true, ret: '4514' }], [tx]), tx, 0)).toBeNull();
		expect(pickSwapRefund(out([{ ok: true, ret: 'not json' }], [tx]), tx, 0)).toBeNull();
	});

	it('a failed call is not a refund (it shows as failed)', () => {
		expect(pickSwapRefund(out([{ ok: false, ret: refundRet }], [tx]), tx, 0)).toBeNull();
	});

	it("never takes a sibling op's or another transaction's result", () => {
		expect(pickSwapRefund(out([{ ok: true, ret: refundRet }], [`${tx}-1`]), tx, 0)).toBeNull();
		expect(pickSwapRefund(out([{ ok: true, ret: refundRet }], ['bafyother']), tx, 0)).toBeNull();
		// The second op of the same transaction is found by its own input id.
		expect(pickSwapRefund(out([{ ok: true, ret: refundRet }], [`${tx}-1`]), tx, 1)?.amount).toBe('2000');
	});

	it('uses only the indices the output names for this transaction', () => {
		const results = [
			{ ok: true, ret: refundRet },
			{ ok: true, ret: '{"amount_out":"1"}' }
		];
		expect(pickSwapRefund(out(results, [tx, tx], [1]), tx, 0)).toBeNull();
		expect(pickSwapRefund(out(results, [tx, tx], [0]), tx, 0)?.to).toBe('hive:alice');
	});
});
