import { writable, derived, get } from 'svelte/store';
import { type GetTransactions$result, GetTransactionsStore } from '$houdini';
import { getLocalTransactions, removeLocalTransaction } from '$lib/stores/localStorageTxs';
import { blockSync } from '../../routes/(authed)/transactions/getDateFromBlockHeight';
import moment from 'moment';

type VscTransaction = NonNullable<GetTransactions$result['findTransaction']>[number];

export interface TransactionInter extends VscTransaction {
	isPending: boolean;
}

export type TransactionOpType = NonNullable<NonNullable<TransactionInter['ops']>[number]>;

export function formatOpType(op: TransactionOpType, sequence: string = 'hbd') {
	const str = op.type;
	if (!str) return str;

	// First, capitalize the first letter
	let result = str.charAt(0).toUpperCase() + str.slice(1);

	// Then capitalize all occurrences of the sequence (case-insensitive search)
	if (sequence) {
		const regex = new RegExp(sequence, 'gi');
		result = result.replace(regex, sequence.toUpperCase());
	}

	return result.replace('_', ' ');
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

export function getTimestamp(tx: TransactionInter): string {
	const timestamp = tx.anchr_ts ?? (tx.first_seen as string);
	if (timestamp.endsWith('Z')) {
		return timestamp;
	}
	return timestamp + 'Z';
}

function deduplicate(txs: TransactionInter[]) {
	const noAlteraID: TransactionInter[] = [];
	const byAlteraID: Record<string, TransactionInter> = {};

	// console.log("deduplicate, txs=", txs);

	for (const tx of txs) {
		// all pending transactions will have an altera ID
		const alteraId = getAlteraID(tx);
		if (!alteraId) {
			noAlteraID.push(tx);
			continue;
		}
		// removes pending transactions more than a day old
		if (
			tx.isPending &&
			new Date().getTime() - new Date(getTimestamp(tx)).getTime() > 24 * 60 * 60 * 1000
		) {
			removeLocalTransaction(alteraId);
			continue;
		}
		// removes if there is a tx with the same altera id, or deduplicates based on regular id
		if (
			byAlteraID[alteraId] ||
			(tx.isPending && noAlteraID.some((tempTx) => tempTx.id === tx.id))
		) {
			removeLocalTransaction(alteraId);
			localTxsStore.update((currentLocalTxs) => {
				return currentLocalTxs.filter((tx) => tx.id !== alteraId);
			});
			if (tx.isPending) {
				continue;
			}
		}
		byAlteraID[alteraId] = tx;
	}

	// console.log("deduplicate, return val=", [...Object.values(byAlteraID), ...Object.values(noAlteraID)]);

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

export function updateTxsFromLocalStorage(did: string) {
	const txs = getLocalTransactions();
	let hasThisAcc = [];
	for (const tx of txs) {
		if (!tx.ops) continue;
		let approved = false;
		for (const op of tx.ops) {
			if (op?.data.from === did) {
				approved = true;
			}
		}
		if (approved) {
			hasThisAcc.push(tx);
		}
	}
	// don't update store unless different
	if (hasThisAcc.length > 0) {
		let identical = true;
		const currentIds = new Set(get(localTxsStore).map((tx) => tx.id));
		hasThisAcc.forEach((entry) => {
			if (!currentIds.has(entry.id)) identical = false;
		});
		if (!identical) localTxsStore.set(hasThisAcc);
	} else if (get(localTxsStore).length > 0) {
		localTxsStore.set([]);
	}
}

export function clearAllStores() {
	vscTxsStore.set([]);
	localTxsStore.set([]);
}

// load txs from store
// set: sets the store to the txs loaded
// update: loads new txs, adds any that aren't in local store to the front
// extend: loads older txs than last in store, adds to the back
export function fetchTxs(
	did: string,
	type: 'set' | 'update' | 'extend',
	setLoading?: (val: boolean) => void,
	limit = 12
) {
	if (type !== 'update') {
		if (setLoading) setLoading(true);
	}
	new GetTransactionsStore()
		.fetch({
			variables: {
				limit: limit,
				did,
				offset: type === 'extend' ? get(vscTxsStore).length : undefined
			},
			policy: 'NetworkOnly'
		})
		.then((post) => {
			if (!post.data?.findTransaction) {
				if (type === 'set') {
					vscTxsStore.set([]);
				}
				if (setLoading) setLoading(false);
				return;
			}
			const fetchedTxs = toTransactionInter(post.data.findTransaction);
			switch (type) {
				case 'set':
					vscTxsStore.set(fetchedTxs);
					break;
				case 'extend':
					vscTxsStore.update((currentTxs) => currentTxs.concat(fetchedTxs));
					break;
				default: // also case for update, since this is most robust
					if (get(vscTxsStore).length > 0 && fetchedTxs[0].id == get(vscTxsStore)[0].id) break; // nothing to update
					vscTxsStore.update((currentTxs) => {
						const fetchedTxs = toTransactionInter(post.data!.findTransaction!);
						const prevUpdate = fetchedTxs.findIndex((v) => v.id === currentTxs[0]?.id);

						// sets the store to only new txs if > limit new txs
						if (prevUpdate === -1) {
							return fetchedTxs;
						}

						// Prepend only new transactions
						return [...fetchedTxs.slice(0, prevUpdate), ...currentTxs];
					});
			}
			if (fetchedTxs.length > 0) {
				blockSync.set({
					height: fetchedTxs[0].anchr_height,
					time: moment(getTimestamp(fetchedTxs[0]))
				});
			}
			if (setLoading) setLoading(false);
		})
		.catch((e) => {
			if (e.name !== 'AbortError') {
				console.error(e);
			}
		});
	updateTxsFromLocalStorage(did);
}

export function waitForExtend(did: string, limit = 12): Promise<boolean> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			resolve(false);
		}, 2000);

		// can use value! because only called from getLastPaid()
		fetchTxs(
			did,
			'extend',
			(val) => {
				if (val === false) {
					clearTimeout(timeout);
					resolve(true);
				}
			},
			limit
		);
	});
}
