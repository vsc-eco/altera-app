import { writable, derived } from 'svelte/store';
import { type GetTransactions$result } from '$houdini';
import { getLocalTransactions, removeLocalTransaction } from '$lib/send/localStorageTxs';

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
	if (!tx.ops) return null;
	let altera_id = null;
	for (const op of tx.ops) {
		if (!op) continue;
		if (op.data.memo) {
			const params: URLSearchParams = new URLSearchParams(op.data.memo);
			altera_id = params.get('altera_id');
			if (altera_id) {
				return altera_id;
			}
		}
	}
	return null;
}

function getTimestamp(tx: TransactionInter): string {
	if (tx.type == 'hive') {
		return tx.anchr_ts;
	}
	return tx.first_seen;
}

function deduplicate(txs: TransactionInter[]) {
	const noAlteraID: TransactionInter[] = [];
	const byAlteraID: Record<string, TransactionInter> = {};
	let deleted = false;

	// console.log("deduplicate, txs=", txs);

	for (const tx of txs) {
	  	// all pending transactions will have an altera ID
		const alteraId = getAlteraID(tx);
		if (!alteraId) {
			noAlteraID.push(tx);
			continue
		}
	  	// removes pending transactions more than a day old
	  	if (tx.isPending && ((new Date()).getTime() - (new Date(getTimestamp(tx))).getTime() > 24 * 60 * 60 * 1000)) {
			removeLocalTransaction(alteraId);
			deleted = true;
			continue;
		}
		// removes if there is a tx with the same altera id, or deduplicates based on regular id
		if (byAlteraID[alteraId] || (tx.isPending && noAlteraID.some(tempTx => tempTx.id === tx.id))) {
			removeLocalTransaction(alteraId);
			deleted = true;
			if (tx.isPending) {
				continue;
			}
		}
		byAlteraID[alteraId] = tx;
	}

	// console.log("deduplicate, return val=", [...Object.values(byAlteraID), ...Object.values(noAlteraID)]);

	if (deleted) updateTxsFromLocalStorage();
	return [...Object.values(byAlteraID), ...Object.values(noAlteraID)];
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
			const timeA = new Date(getTimestamp(a)).getTime();
			const timeB = new Date(getTimestamp(b)).getTime();
			return timeB - timeA;
		});
	}
);

export function updateTxsFromLocalStorage() {
	const txs = getLocalTransactions();
	if (txs.length > 0) localTxsStore.set(txs);
}
