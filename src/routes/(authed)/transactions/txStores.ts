import { writable, derived } from 'svelte/store';
import { isPending, type GetTransactions$result } from '$houdini';
import { getLocalTransactions, removeLocalTransaction } from '$lib/send/localStorageTransactions';
import { idchain } from 'viem/chains';
import type { Transaction } from 'viem';

type VscTransaction = NonNullable<GetTransactions$result['findTransaction']>[number];

export interface TransactionInter extends VscTransaction {
	isPending: boolean;
}

export function toTransactionInter(txs: VscTransaction[]): TransactionInter[] {
	return txs.map((tx) => ({ ...tx, isPending: false }));
}

export const vscTxsStore = writable<TransactionInter[]>([]);
export const localTxsStore = writable<TransactionInter[]>([]);

function getAlteraID(tx: TransactionInter) {
	if (tx.isPending) return tx.id;
	return tx.data.memo ? tx.data.memo.match(/(?:^|&)altera_id=([a-z0-9-]+)/)?.[1] : null;
}

function deduplicate(txs: TransactionInter[]) {
	const noSameNormalId = Object.values(
		txs.reduce(
			(acc, curr) => {
				// Use the transaction ID as the key to ensure uniqueness
				acc[curr.id] = curr;
				return acc;
			},
			{} as { [id: string]: TransactionInter }
		)
	);

	const noAlteraID: TransactionInter[] = [];
	const byAlteraID: Record<string, TransactionInter> = {};
	let deleted = false;

	for (const tx of noSameNormalId) {
		const alteraId = getAlteraID(tx);
		if (tx.isPending && ((new Date()).getTime() - tx.first_seen.getTime() > 24 * 60 * 60 * 1000)) {
			removeLocalTransaction(alteraId);
			deleted = true;
			continue;
		}
		if (!alteraId) {
			noAlteraID.push(tx);
			continue
		}
		if (byAlteraID[alteraId] || (tx.isPending && noAlteraID.some(tempTx => tempTx.tx_id === tx.tx_id))) {
			removeLocalTransaction(alteraId);
			deleted = true;
			if (tx.isPending) {
				continue;
			}
		}
		byAlteraID[alteraId] = tx;
	}

	if (deleted) updateTxsFromLocalStorage();
	return [ ...Object.values(byAlteraID), ...Object.values(noAlteraID) ]
}

// Create a derived store that combines and sorts transactions
export const allTransactionsStore = derived(
	[vscTxsStore, localTxsStore],
	([$vscTxsStore, $localTxsStore]) => {
		// Combine both sources
		const combined = [...$vscTxsStore, ...$localTxsStore];

		const uniqueTransactions = deduplicate(combined);

		// Sort by timestamp (descending)
		return uniqueTransactions.sort((a, b) => {
			const timeA = new Date(a.first_seen).getTime();
			const timeB = new Date(b.first_seen).getTime();
			return timeB - timeA;
		});
	}
);

export function updateTxsFromLocalStorage() {
	const txs = getLocalTransactions();
	if (txs.length > 0) localTxsStore.set(txs);
}