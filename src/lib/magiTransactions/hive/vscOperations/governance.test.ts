import { describe, it, expect } from 'vitest';
import { getReserveVoteOp } from './governance';

describe('getReserveVoteOp', () => {
	it('builds the vsc.reserve_vote custom_json with the exact wire shape', () => {
		const op = getReserveVoteOp('witness2', 'reserve_payout:9f86d0');

		expect(op).toEqual([
			'custom_json',
			{
				required_auths: ['witness2'],
				required_posting_auths: [],
				id: 'vsc.reserve_vote',
				json: JSON.stringify({ id: 'reserve_payout:9f86d0' })
			}
		]);
	});

	it("references the proposal via the payload's `id` field", () => {
		const [, payload] = getReserveVoteOp('alice', 'slash_restore:abc123');
		expect(JSON.parse(payload.json)).toEqual({ id: 'slash_restore:abc123' });
	});

	it('signs with the voter as the sole required active auth', () => {
		const [, payload] = getReserveVoteOp('alice', 'reserve_payout:deadbeef');
		expect(payload.required_auths).toEqual(['alice']);
		expect(payload.required_posting_auths).toEqual([]);
	});
});
