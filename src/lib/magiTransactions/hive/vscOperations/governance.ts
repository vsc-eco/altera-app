import type { CustomJsonOperation } from '@hiveio/dhive';

/**
 * Build a `vsc.reserve_vote` custom_json op — a witness's approval vote on an
 * open governance proposal (a reserve payout or a slash restoration).
 *
 * The payload's `id` is the proposal's deterministic `proposalId` (e.g.
 * `reserve_payout:<sha256hex>`), which is the unit witnesses reference when
 * voting. Signed with the voter's Active authority, like the other VSC
 * consensus ops.
 *
 * @param voter the voting witness's Hive account (the signed-in user)
 * @param proposalId the GovernanceProposal.proposalId being approved
 */
export function getReserveVoteOp(voter: string, proposalId: string): CustomJsonOperation {
	return [
		'custom_json',
		{
			required_auths: [voter],
			required_posting_auths: [],
			id: 'vsc.reserve_vote',
			json: JSON.stringify({ id: proposalId })
		}
	];
}
