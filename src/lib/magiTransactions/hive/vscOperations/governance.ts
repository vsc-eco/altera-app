import type { CustomJsonOperation } from '@hiveio/dhive';

/**
 * Build a `vsc.reserve_vote` custom_json op — a witness's approval vote on an
 * open RESERVE-PAYOUT proposal. (Slash restorations use a different op — see
 * `getSlashRestoreVoteOp`.)
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

/**
 * Build a `vsc.slash_restore` custom_json op — a witness's vote to restore a
 * wrongfully-slashed bond while the slash is still pending.
 *
 * Unlike reserve spends (`vsc.reserve_vote`, keyed by proposalId), restorations
 * use THIS op for BOTH proposing and voting, keyed by the slash's Hive tx id +
 * the slashed account — the first such op creates the proposal and records the
 * proposer's vote. Mirrors the node's `vsc.slash_restore` handler payload
 * (`{ id: <slash tx id>, account: <slashed account> }`, see go-vsc-node
 * modules/state-processing/governance_slash_restore.go). Signed with the
 * voter's Active authority.
 *
 * @param voter the voting witness's Hive account (the signed-in user)
 * @param slashTxId the Hive tx id of the safety slash (GovernanceProposal.slashTxId)
 * @param slashedAccount the slashed account to restore (GovernanceProposal.slashedAccount)
 */
export function getSlashRestoreVoteOp(
	voter: string,
	slashTxId: string,
	slashedAccount: string
): CustomJsonOperation {
	return [
		'custom_json',
		{
			required_auths: [voter],
			required_posting_auths: [],
			id: 'vsc.slash_restore',
			json: JSON.stringify({ id: slashTxId, account: slashedAccount })
		}
	];
}
