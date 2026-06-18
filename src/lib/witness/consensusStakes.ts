import { GetTransactionsStore } from '$houdini';

export type NodeStake = {
	/** bare hive account of the node staked into, e.g. 'magi-team-node' */
	node: string;
	/** net HIVE currently staked into this node (stake − unstake), always > 0 */
	staked: number;
};

const STAKE_TYPES = ['consensus_stake', 'consensus_unstake'];
const PAGE = 100;
const PAGE_GUARD = 50; // up to 5000 consensus ops; far beyond any real account

/** Strip the `hive:` prefix to a bare account name. */
function bareAccount(account: string): string {
	return account.replace(/^hive:/, '');
}

/** HIVE has 3 decimals; round away float drift from summing op strings. */
function roundHive(n: number): number {
	return Math.round(n * 1000) / 1000;
}

/**
 * Reconstruct how much HIVE `did` currently has staked into each node by netting
 * consensus_stake − consensus_unstake ops from its transaction history.
 *
 * VSC attributes consensus stake to the *node* account (the op's `to`), not the
 * staker, so a delegator's own `getAccountBalance.hive_consensus` is always 0.
 * Until the API exposes per-(staker, node) stake directly, this history netting
 * is the only way to recover a delegator's unstakeable balance per node.
 *
 * @param did the staker's DID, e.g. `hive:lordbutterfly`
 * @returns nodes with a positive net stake, largest first
 */
export async function fetchStakesByNode(did: string): Promise<NodeStake[]> {
	const byNode = new Map<string, number>();

	for (let guard = 0, offset = 0; guard < PAGE_GUARD; guard++, offset += PAGE) {
		const res = await new GetTransactionsStore().fetch({
			variables: { did, limit: PAGE, offset, byType: STAKE_TYPES },
			policy: 'NetworkOnly'
		});
		const txs = res.data?.findTransaction ?? [];
		for (const tx of txs) {
			// Skip failed txs; their ops never affected stake.
			if (tx?.status === 'FAILED') continue;
			for (const op of tx?.ops ?? []) {
				// A stake/unstake tx also bundles a deposit/withdraw op — take only
				// the consensus op, whose `to` is the node and `amount` is in HIVE.
				if (op?.type !== 'consensus_stake' && op?.type !== 'consensus_unstake') continue;
				const data = op.data as { to?: string; amount?: string };
				const amount = Number(data?.amount);
				if (!data?.to || !Number.isFinite(amount)) continue;
				const node = bareAccount(data.to);
				const delta = op.type === 'consensus_stake' ? amount : -amount;
				byNode.set(node, (byNode.get(node) ?? 0) + delta);
			}
		}
		if (txs.length < PAGE) break;
	}

	return [...byNode.entries()]
		.map(([node, staked]) => ({ node, staked: roundHive(staked) }))
		.filter((s) => s.staked > 0)
		.sort((a, b) => b.staked - a.staked);
}
