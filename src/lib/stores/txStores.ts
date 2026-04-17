import { writable, derived, get } from 'svelte/store';
import { type GetTransactions$result, GetTransactionsStore } from '$houdini';
import { getLocalTransactions, removeLocalTransaction } from '$lib/stores/localStorageTxs';
import { blockSync } from '../../routes/(authed)/transactions/getDateFromBlockHeight';
import moment from 'moment';
import { authStore } from '$lib/auth/store';
import { clearLastPaidCache } from '$lib/sendswap/utils/sendUtils';
import { type BtcDepositEvent, fetchBtcDepositsByRecipient } from '$lib/indexer/btcMappingQueries';

type MagiTransaction = NonNullable<GetTransactions$result['findTransaction']>[number];

export interface TransactionInter extends MagiTransaction {
	isPending: boolean;
}

export type TransactionOpType = NonNullable<NonNullable<TransactionInter['ops']>[number]>;

// formats the title of an operation by capitalizing the first letters of each word and
// any occurances of the sequence substring, "hbd" by default
export function formatOpType(type: string, sequence: string = 'hbd') {
	// First, capitalize the first letter
	let result = type.charAt(0).toUpperCase() + type.slice(1);

	// Then capitalize all occurrences of the sequence (case-insensitive search)
	const regex = new RegExp(sequence, 'gi');
	result = result.replace(regex, sequence.toUpperCase());

	return result.replace('_', ' ');
}

export function toTransactionInter(txs: MagiTransaction[]): TransactionInter[] {
	return txs.map((tx) => ({ ...tx, isPending: false }));
}

export type TxListItem =
	| { kind: 'vsc'; tx: TransactionInter }
	| { kind: 'btc-deposit'; event: BtcDepositEvent };

export const magiTxsStore = writable<TransactionInter[]>([]);
export const localTxsStore = writable<TransactionInter[]>([]);
export const btcDepositStore = writable<BtcDepositEvent[]>([]);

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
	const timestamp = tx.anchr_ts ?? tx.first_seen;
	if (timestamp.endsWith('Z')) {
		return timestamp;
	}
	return timestamp + 'Z';
}

// This depends on magi txs occuring earlier in the array
// because its [...$magiTxsStore, ...$localTxsStore]
function deduplicate(txs: TransactionInter[]) {
	const noAlteraID: TransactionInter[] = [];
	const byAlteraID: Record<string, TransactionInter> = {};

	// console.log("deduplicate, txs=", txs);
	let removedAnyPending = false;
	const acc = new Map<string, TransactionInter>();
	txs.forEach((tx) => {
		if (acc.has(tx.id)) {
			if (tx.isPending) {
				removeLocalTransaction(tx.id);
				removedAnyPending = true;
			}
		} else {
			acc.set(tx.id, tx);
		}
	});

	if (removedAnyPending) {
		const did = get(authStore).value?.did;
		if (did) updateTxsFromLocalStorage(did);
	}
	return [...acc.values()];

	// for (const tx of txs) {
	// 	// all pending transactions will have an altera ID
	// 	const alteraId = getAlteraID(tx);
	// 	if (!alteraId) {
	// 		noAlteraID.push(tx);
	// 		continue;
	// 	}
	// 	// removes pending transactions more than a day old
	// 	if (
	// 		tx.isPending &&
	// 		new Date().getTime() - new Date(getTimestamp(tx)).getTime() > 24 * 60 * 60 * 1000
	// 	) {
	// 		removeLocalTransaction(alteraId);
	// 		continue;
	// 	}
	// 	// removes if there is a tx with the same altera id, or deduplicates based on regular id
	// 	if (
	// 		byAlteraID[alteraId] ||
	// 		(tx.isPending && noAlteraID.some((tempTx) => tempTx.id === tx.id))
	// 	) {
	// 		removeLocalTransaction(alteraId);
	// 		localTxsStore.update((currentLocalTxs) => {
	// 			return currentLocalTxs.filter((tx) => tx.id !== alteraId);
	// 		});
	// 		if (tx.isPending) {
	// 			continue;
	// 		}
	// 	}
	// 	byAlteraID[alteraId] = tx;
	// }

	// // console.log("deduplicate, return val=", [...Object.values(byAlteraID), ...Object.values(noAlteraID)]);

	// return [...Object.values(byAlteraID), ...Object.values(noAlteraID)];
}

// Create a derived store that combines and sorts transactions
export const allTransactionsStore = derived(
	[magiTxsStore, localTxsStore, btcDepositStore],
	([$magiTxsStore, $localTxsStore, $btcDepositStore]) => {
		const vscItems: TxListItem[] = deduplicate([...$magiTxsStore, ...$localTxsStore]).map((tx) => ({
			kind: 'vsc',
			tx
		}));
		const btcItems: TxListItem[] = $btcDepositStore.map((event) => ({
			kind: 'btc-deposit',
			event
		}));

		return [...vscItems, ...btcItems].sort((a, b) => {
			const tsA =
				a.kind === 'vsc'
					? new Date(getTimestamp(a.tx)).getTime()
					: new Date(
							a.event.indexer_ts.endsWith('Z') ? a.event.indexer_ts : a.event.indexer_ts + 'Z'
						).getTime();
			const tsB =
				b.kind === 'vsc'
					? new Date(getTimestamp(b.tx)).getTime()
					: new Date(
							b.event.indexer_ts.endsWith('Z') ? b.event.indexer_ts : b.event.indexer_ts + 'Z'
						).getTime();
			return tsB - tsA;
		});
	}
);

/**
 * Fetch BTC deposit events for the given DID within a VSC block height range and merge them
 * into btcDepositStore (deduplicating by indexer_tx_hash).
 */
export async function fetchBtcDeposits(
	did: string,
	type: 'set' | 'update' | 'extend',
	limit = 20
): Promise<void> {
	if (!did) return;
	try {
		let beforeHeight: number | undefined;
		if (type === 'extend') {
			const current = get(btcDepositStore);
			if (current.length === 0) return;
			beforeHeight = Math.min(...current.map((e) => e.indexer_block_height));
		}
		const events = await fetchBtcDepositsByRecipient(did, limit, beforeHeight);
		if (type === 'set') {
			btcDepositStore.set(events);
			return;
		}
		if (events.length === 0) return;
		btcDepositStore.update((current) => {
			const byHash = new Map(current.map((e) => [e.indexer_tx_hash, e]));
			for (const e of events) byHash.set(e.indexer_tx_hash, e);
			return Array.from(byHash.values());
		});
	} catch (e) {
		console.error('Failed to fetch BTC deposits', e);
	}
}

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
	magiTxsStore.set([]);
	localTxsStore.set([]);
	btcDepositStore.set([]);
}

// load txs from store
// set: sets the store to the txs loaded
// update: loads new txs, adds any that aren't in local store to the front
// extend: loads older txs than last in store, adds to the back
export async function fetchTxs(
	did: string,
	type: 'set' | 'update' | 'extend',
	setLoading?: (val: boolean) => void,
	limit = 12
) {
	if (type !== 'update') {
		if (setLoading) setLoading(true);
	}
	const success = await new GetTransactionsStore()
		.fetch({
			variables: {
				limit: limit,
				did,
				offset: type === 'extend' ? get(magiTxsStore).length : undefined
			},
			policy: 'NetworkOnly'
		})
		.then((post) => {
			if (!post.data?.findTransaction) {
				if (type === 'set') {
					magiTxsStore.set([]);
				}
				if (setLoading) setLoading(false);
				return true;
			}
			const fetchedTxs = toTransactionInter(post.data.findTransaction);
			if (fetchedTxs.length > 0) clearLastPaidCache();
			switch (type) {
				case 'set':
					magiTxsStore.set(fetchedTxs);
					break;
				case 'extend':
					magiTxsStore.update((currentTxs) => currentTxs.concat(fetchedTxs));
					break;
				default: // also case for update, since this is most robust
					if (get(magiTxsStore).length > 0 && fetchedTxs[0].id == get(magiTxsStore)[0].id) break; // nothing to update
					magiTxsStore.update((currentTxs) => {
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
			return true;
		})
		.catch((e) => {
			if (e.name !== 'AbortError') {
				console.error(e);
			}
			return false;
		});
	updateTxsFromLocalStorage(did);
	return success;
}

export async function waitForExtend(did: string, limit = 12): Promise<boolean> {
	await fetchTxs(did, 'extend', undefined, limit);
	return true;
}
