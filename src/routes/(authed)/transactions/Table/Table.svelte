<script lang="ts">
	import { GetTransactionsStore } from '$houdini';
	import Tr from './tr/Tr.svelte';
	import { untrack } from 'svelte';
	import { allTransactionsStore, vscTxsStore, toTransactionInter, updateTxsFromLocalStorage } from '../txStores';
	let {
		did
	}: {
		did: string;
	} = $props();
	let store = $derived(new GetTransactionsStore());
	let loading = $state(true);
	function fetchFromStore() {
		untrack(() => store)
			.fetch({
				variables: {
					limit: 20,
					did
				}
			})
			.then((posts) => {
				loading = false;
				if (!posts.data?.findTransaction) return;
				// set the store since this is a complete fetch
				console.log("setting txs to: ", toTransactionInter(posts.data?.findTransaction));
				vscTxsStore.set(toTransactionInter(posts.data?.findTransaction));
			}).catch((e) => {
				if (e.name !== 'AbortError') {
					console.error(e);
				}
			});
	}
	// this assumes that did doesn't change, and is not reactive to did
	// just runs once when the page loads and again if too many new transactions
	// are added (called explicitly below)
	$effect(() => {
		fetchFromStore();
	});
	$effect(() => {
		const intervalId = setInterval(() => {
			new GetTransactionsStore()
				.fetch({
					variables: {
						limit: 20,
						did
					},
					policy: 'NetworkOnly'
				})
				.then((post) => {
					loading = false;
					if (!post.data?.findTransaction) return;
					if ($vscTxsStore.length > 0 && post.data?.findTransaction[0].id == $vscTxsStore[0].id) return; // nothing to update

					vscTxsStore.update((currentTxs) => {
						const fetchedTxs = toTransactionInter(post.data!.findTransaction!);							
						const prevUpdate = fetchedTxs.findIndex(v => v.id === currentTxs[0]?.id);
						
						if (prevUpdate === -1) {
							// Too many new transactions, replace entirely
							fetchFromStore();
							return currentTxs;
						}
						
						// Prepend only new transactions
						console.log("backend txs:", [...fetchedTxs.slice(0, prevUpdate), ...currentTxs])
						return [...fetchedTxs.slice(0, prevUpdate), ...currentTxs];
					});
				}).catch((e) => {
					if (e.name !== 'AbortError') {
						console.error(e);
					}
				});
			updateTxsFromLocalStorage();
		}, 2000);
		return () => clearInterval(intervalId);
	});
	let currStoreLen = $derived($allTransactionsStore.length);
</script>

<svelte:document
	onscroll={(_e) => {
		const me = document.documentElement;
		if (me.scrollHeight - me.scrollTop - me.clientHeight < 1) {
			loading = true;
			store
				.fetch({
					variables: {
						limit: 12, // FIXME: add back once server properly supports pagination
						did,
						offset: currStoreLen
					}
				})
				.then((posts) => {
					loading = false;
					if (!posts.data?.findTransaction) return;
					vscTxsStore.update(currentTxs => currentTxs.concat(toTransactionInter(posts.data?.findTransaction!)))
				}).catch((e) => {
					if (e.name !== 'AbortError') {
						console.error(e);
					}
				});;
		}
	}}
/>
<div
	class="scroll"
	onscroll={(e) => {
		const me = e.currentTarget;
		if (me.scrollHeight - me.scrollTop - me.clientHeight < 1) {
			loading = true;
			store
				.fetch({
					variables: {
						limit: 12, // FIXME: add back once server properly supports pagination
						did,
						offset: currStoreLen
					}
				})
				.then((posts) => {
					loading = false;
					if (!posts.data?.findTransaction) return;
					vscTxsStore.update(currentTxs => currentTxs.concat(toTransactionInter(posts.data?.findTransaction!)))
				});
		}
	}}
>
	<table>
		<thead>
			<tr>
				<th>Date</th>
				<th class="to-from-header">To/From</th>
				<th class="amount-header">Amount</th>
				<th class="token-header">Token</th>
				<th>Type</th>
			</tr>
		</thead>

		<tbody>
			{#if $allTransactionsStore && $allTransactionsStore.length > 0}
				{#each $allTransactionsStore as tx (tx.id)}
					{@const { ops, id } = tx}
					{#each ops! as op}
						{#if op}
							{@const { data } = op}
							<!-- TODO: Check in with vaultec to see if I should have each ledger as a tx row -->
							<!-- {#if ledger?.length != 0}
							{#each ledger! as _, i}
								<Tr {tx} ledgerIndex={i} />
							{/each} -->
							{#if new Set( ['from', 'to', 'asset', 'amount'] ).isSubsetOf(new Set(Object.keys(data)))}
								<Tr {tx} {op} />
							{:else}
								<tr
									><td colspan="100">Transaction #{id} with type {tx.type} is unsupported.</td
									></tr
								>
							{/if}
						{/if}
					{/each}
				{/each}
			{:else}
				<tr><td colspan="100">No Transactions found.</td></tr>
			{/if}
			{#if loading}
				<tr><td colspan="100" class="loading">Loading..</td></tr>
			{/if}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow: auto;
		width: 100%;
		flex-grow: 1;
	}
	table {
		width: 100%;
		border-spacing: 1rem 0.5rem;
		border-collapse: collapse;
	}
	.loading {
		background-color: var(--neutral-bg-accent);
	}
	thead {
		position: sticky;
		top: 0;
		z-index: 1;
		background-color: var(--neutral-bg);
	}
	th {
		text-align: left;
		min-width: max-content;
		box-sizing: content-box;
		padding: 0.5rem min(1rem, 2%);
	}
	table :global(td) {
		vertical-align: middle;
		width: max-content;
		border-bottom: 1px solid var(--neutral-bg-accent);
	}

	.token-header {
		padding-left: 0;
	}
	.amount-header {
		text-align: right;
		padding-right: 1rem;
	}

	.to-from-header {
		padding-left: 3rem;
	}
</style>
