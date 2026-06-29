import { describe, it, expect } from 'vitest';
import { getReserveVoteOp, getSlashRestoreVoteOp } from './governance';

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

describe('getSlashRestoreVoteOp', () => {
	it('builds the vsc.slash_restore custom_json keyed by slash tx id + account', () => {
		// NOTE: keyed by the slash tx id + slashed account, NOT proposalId — and
		// signed by the voter alone (Active auth), distinct from vsc.reserve_vote.
		expect(getSlashRestoreVoteOp('witness2', 'abc123txid', 'slashed.acct')).toEqual([
			'custom_json',
			{
				required_auths: ['witness2'],
				required_posting_auths: [],
				id: 'vsc.slash_restore',
				json: JSON.stringify({ id: 'abc123txid', account: 'slashed.acct' })
			}
		]);
	});

	it('is a distinct op from reserve_vote (different id + payload shape)', () => {
		expect(getSlashRestoreVoteOp('alice', 'tx1', 'bob')).toEqual([
			'custom_json',
			{
				required_auths: ['alice'],
				required_posting_auths: [],
				id: 'vsc.slash_restore',
				json: JSON.stringify({ id: 'tx1', account: 'bob' })
			}
		]);
		expect(getReserveVoteOp('alice', 'reserve_payout:tx1')).toEqual([
			'custom_json',
			{
				required_auths: ['alice'],
				required_posting_auths: [],
				id: 'vsc.reserve_vote',
				json: JSON.stringify({ id: 'reserve_payout:tx1' })
			}
		]);
	});
});
