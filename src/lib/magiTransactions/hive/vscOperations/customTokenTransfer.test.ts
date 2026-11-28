import { describe, it, expect } from 'vitest';
import {
	getCustomTokenTransferOp,
	CUSTOM_TOKEN_TRANSFER_RC
} from './customTokenTransfer';

/**
 * A custom token moves by a contract call, not a ledger transfer, so what the
 * op has to get right is: the TOKEN's contract (not the router's, not the
 * ledger's), the action and payload @vsc.eco/token-core sends, and an amount
 * in smallest units as a string.
 */
const TOKEN = 'vsc1Btokencontract0000000000000000000000';

function payloadOf(op: ReturnType<typeof getCustomTokenTransferOp>) {
	const json = JSON.parse((op[1] as { json: string }).json);
	return { ...json, payload: JSON.parse(json.payload) };
}

describe('getCustomTokenTransferOp', () => {
	it('calls `transfer` on the token contract with the recipient DID', () => {
		const op = getCustomTokenTransferOp('alice', TOKEN, 'hive:bob', 1234);
		const call = payloadOf(op);
		expect(call.contract_id).toBe(TOKEN);
		expect(call.action).toBe('transfer');
		expect(call.caller).toBe('hive:alice');
		expect(call.payload).toEqual({ to: 'hive:bob', amount: '1234' });
		expect(call.intents).toEqual([]);
	});

	it('signs with the active authority of the sender', () => {
		const op = getCustomTokenTransferOp('alice', TOKEN, 'hive:bob', 1);
		expect(op[0]).toBe('custom_json');
		expect(op[1]).toMatchObject({
			id: 'vsc.call',
			required_auths: ['alice'],
			required_posting_auths: []
		});
	});

	it('passes a non-Hive recipient through as the DID it was given', () => {
		// A wallet login's Magi account IS an address: `hive:0x…` owns nothing,
		// so the caller resolves the DID and this must not touch it.
		const did = 'did:pkh:eip155:1:0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
		expect(payloadOf(getCustomTokenTransferOp('alice', TOKEN, did, 5)).payload.to).toBe(did);
	});

	it('sends the amount as an integer string, never a float or a number', () => {
		// 8-decimal token: 1.5 of it is 150000000 smallest units, and the
		// contract reads a string.
		const call = payloadOf(getCustomTokenTransferOp('alice', TOKEN, 'hive:bob', 150000000));
		expect(call.payload.amount).toBe('150000000');
		expect(typeof call.payload.amount).toBe('string');
	});

	it('stays at the free RC allowance, so no HBD is reserved for the call', () => {
		// Above 10,000 the node reserves (rc_limit − free RC) of the caller's
		// HBD before the call, which would make a token transfer need HBD.
		expect(CUSTOM_TOKEN_TRANSFER_RC).toBe(10_000);
		expect(payloadOf(getCustomTokenTransferOp('alice', TOKEN, 'hive:bob', 1)).rc_limit).toBe(
			10_000
		);
	});
});
