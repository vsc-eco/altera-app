/**
 * The shared source of recent transactions for the deposit / withdraw /
 * transfer rails.
 *
 * ## Why this exists
 *
 * Each rail used to run its own `queryOnce(new GetTransactionsStore(), …)`.
 * That is a fourth concurrent query for the same Houdini document, and it
 * races the app's other transaction fetches — the loser is ABORTED
 * (`AbortError: aborted`), its catch empties the list, and the rail renders
 * "No … yet" over an account that has plenty. It is a silent failure: an
 * empty rail looks exactly like a true empty result.
 *
 * Reading the shared `magiTxsStore` instead removes the race AND the
 * duplicate request, and keeps the rail live as the store updates.
 *
 * ## Duplicates
 *
 * `magiTxsStore` can hold the same transaction twice — a `set` followed by an
 * `update`/`extend`, or a pending local tx that has since confirmed. The
 * rails key their `{#each}` on an id derived from `tx.id`, so a duplicate tx
 * means a duplicate key, and Svelte throws `each_key_duplicate`. That throw
 * leaves the component tree broken: the rail stops updating, keeps its
 * spinner forever, and can even render on the next route. So dedupe at the
 * source rather than leaving each rail to notice.
 */
import { getAuth } from '$lib/auth/store';
import { fetchTxs, magiTxsStore, type TransactionInter } from '$lib/stores/txStores';
import { get } from 'svelte/store';

/** How many transactions to pull when the shared store is cold. */
export const RECENT_TX_FETCH_LIMIT = 30;

/**
 * First occurrence of each `tx.id`, order preserved. A transaction with no id
 * is kept as-is — dropping it would hide real activity, and the rails fall
 * back to a positional key for those.
 */
export function dedupeTxsById<T extends { id?: string | null }>(txs: readonly T[]): T[] {
	const seen = new Set<string>();
	const out: T[] = [];
	for (const tx of txs) {
		const id = tx?.id;
		if (typeof id === 'string' && id.length > 0) {
			if (seen.has(id)) continue;
			seen.add(id);
		}
		out.push(tx);
	}
	return out;
}

export type RecentTxs = {
	/** Deduplicated, newest-first as the store holds them. */
	readonly txs: TransactionInter[];
	/** A fetch is in flight and we have nothing to show yet. */
	readonly loading: boolean;
	/** Auth settled with no account — the rail should say so, not show empty. */
	readonly unauth: boolean;
};

/**
 * Call once from a rail's component init. Subscribes to the shared store and,
 * only if that store is cold, kicks exactly one fetch to warm it.
 */
export function useRecentTxs(): RecentTxs {
	const auth = $derived(getAuth()());
	let txs = $state<TransactionInter[]>([]);
	let kicked = $state(false);
	let fetching = $state(false);

	$effect(() => magiTxsStore.subscribe((value) => (txs = dedupeTxsById(value))));

	$effect(() => {
		if (kicked) return;
		if (auth.status === 'pending') return;
		kicked = true;
		const did = auth.value?.did;
		if (!did) return;
		// Someone else may already have filled it (the transactions page, the
		// notification feed). Only pay for a fetch when it is cold.
		if (get(magiTxsStore).length > 0) return;
		fetching = true;
		// `finally` so an aborted or failed fetch still clears the spinner —
		// a rail that spins forever is worse than one that says it is empty.
		fetchTxs(did, 'set', undefined, RECENT_TX_FETCH_LIMIT).finally(() => (fetching = false));
	});

	return {
		get txs() {
			return txs;
		},
		get loading() {
			return fetching && txs.length === 0;
		},
		get unauth() {
			return auth.status !== 'pending' && !auth.value?.did;
		}
	};
}
