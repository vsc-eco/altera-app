<script lang="ts">
	import { GetTransactionsStore } from '$houdini';
	import Tr from './tr/Tr.svelte';
	import { onMount, untrack } from 'svelte';
	import {
		allTransactionsStore,
		vscTxsStore,
		toTransactionInter,
		updateTxsFromLocalStorage
	} from '../txStores';
	import { goto } from '$app/navigation';

	let {
		did,
		allowPopup = true,
		initialOpen
	}: {
		did: string;
		allowPopup?: boolean;
		initialOpen?: [string, number];
	} = $props();
	let store = $derived(new GetTransactionsStore());
	let loading = $state(true);

	let skeletonRowCount = $state(8);
	onMount(() => {
		const rootStyle = getComputedStyle(document.documentElement);
		const remValue = parseFloat(rootStyle.fontSize);

		const calculateRows = () => {
			const tableElement = document.getElementById('transactions-tbody');
			if (tableElement) {
				const rowHeight = remValue * 4.5;
				const viewportHeight = window.innerHeight;
				const tableTop = tableElement.getBoundingClientRect().top;
				const remainingHeight = viewportHeight - tableTop;
				skeletonRowCount = Math.max(5, Math.floor(remainingHeight / rowHeight));
			}
		};

		calculateRows();
		window.addEventListener('resize', calculateRows);

		return () => window.removeEventListener('resize', calculateRows);
	});

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
				if (!posts.data?.findTransaction) {
					vscTxsStore.set([]);
					return;
				}
				// set the store since this is a complete fetch
				vscTxsStore.set(toTransactionInter(posts.data?.findTransaction));
			})
			.catch((e) => {
				if (e.name !== 'AbortError') {
					console.error(e);
				}
			});
	}
	function fetchAdditionalFromStore(limit = 12) {
		if ($allTransactionsStore && $allTransactionsStore.length > 0) {
			loading = true;
		}
		store
			.fetch({
				variables: {
					limit: limit, // FIXME: add back once server properly supports pagination
					did,
					offset: currStoreLen
				}
			})
			.then((posts) => {
				loading = false;
				if (!posts.data?.findTransaction) return;
				vscTxsStore.update((currentTxs) =>
					currentTxs.concat(toTransactionInter(posts.data?.findTransaction!))
				);
			})
			.catch((e) => {
				if (e.name !== 'AbortError') {
					console.error(e);
				}
			});
	}
	// this assumes that did doesn't change, and is not reactive to did
	// just runs once when the page loads and again if too many new transactions
	// are added (called explicitly below)
	let hasFoundAutoOpenTx = false;
	async function loadUntilTxFound(targetTxId: string) {
		if (!targetTxId || hasFoundAutoOpenTx) return;

		while (!hasFoundAutoOpenTx && !loading) {
			// Check if the transaction is already in the current store
			const currentTxs = $vscTxsStore;
			const foundTx = currentTxs.find((tx) => tx.id === targetTxId);

			if (foundTx) {
				hasFoundAutoOpenTx = true;
				// Scroll to the transaction after a brief delay to ensure DOM is updated
				setTimeout(() => {
					const txElement = document.querySelector(`[data-tx-id="${targetTxId}"]`);
					if (txElement) {
						txElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}
				}, 100);
				break;
			}

			loading = true;
			try {
				const posts = await store.fetch({
					variables: {
						limit: 12,
						did,
						offset: currStoreLen
					}
				});

				loading = false;
				if (!posts.data?.findTransaction || posts.data.findTransaction.length === 0) {
					// No more transactions to load
					break;
				}
				vscTxsStore.update((currentTxs) =>
					currentTxs.concat(toTransactionInter(posts.data?.findTransaction!))
				);
			} catch (error) {
				if (error instanceof Error && error.name !== 'AbortError') {
					console.error(error);
				}
				break;
			}
		}
	}
	$effect(() => {
		if (initialOpen && !hasFoundAutoOpenTx) {
			loadUntilTxFound(initialOpen[0]);
		}
	});
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
					if ($vscTxsStore.length > 0 && post.data?.findTransaction[0].id == $vscTxsStore[0].id)
						return; // nothing to update

					vscTxsStore.update((currentTxs) => {
						const fetchedTxs = toTransactionInter(post.data!.findTransaction!);
						const prevUpdate = fetchedTxs.findIndex((v) => v.id === currentTxs[0]?.id);

						if (prevUpdate === -1) {
							// Too many new transactions, replace entirely
							fetchFromStore();
							return currentTxs;
						}

						// Prepend only new transactions
						return [...fetchedTxs.slice(0, prevUpdate), ...currentTxs];
					});
				})
				.catch((e) => {
					if (e.name !== 'AbortError') {
						console.error(e);
					}
				});
			updateTxsFromLocalStorage(did);
		}, 2000);
		return () => clearInterval(intervalId);
	});
	let currStoreLen = $derived($allTransactionsStore.length);
	let openOp: [string, number] | null = $state(initialOpen ?? null);
	function openDetails(op: [string, number]) {
		if (openOp && openOp[0] === op[0] && openOp[1] === op[1]) {
			openOp = null;
		} else {
			openOp = op;
		}
	}
	function openTxsPage(op: [string, number]) {
		const openTxParams = new URLSearchParams();
		openTxParams.set('tx', op[0]);
		openTxParams.set('index', op[1].toString());
		goto(`/transactions?${openTxParams.toString()}`);
	}
</script>

<svelte:document
	onscroll={(_e) => {
		const me = document.documentElement;
		if (me.scrollHeight - me.scrollTop - me.clientHeight < 1) {
			fetchAdditionalFromStore();
		}
	}}
/>
<div
	class="scroll"
	onscroll={(e) => {
		const me = e.currentTarget;
		if (me.scrollHeight - me.scrollTop - me.clientHeight < 1) {
			fetchAdditionalFromStore();
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

		<tbody
			id="transactions-tbody"
			class={!$allTransactionsStore?.length && !loading ? 'no-transactions-container' : ''}
		>
			{#if $allTransactionsStore && $allTransactionsStore.length > 0}
				{#each $allTransactionsStore as tx (tx.id)}
					{@const { ops, id } = tx}
					{#each ops!.sort((a, b) => {
						// put deposits below other ops in their transaction
						return (a?.type === 'deposit' ? 1 : 0) - (b?.type === 'deposit' ? 1 : 0);
					}) as op}
						{#if op}
							{@const { data } = op}
							{#if new Set( ['from', 'to', 'asset', 'amount'] ).isSubsetOf(new Set(Object.keys(data)))}
								<Tr {tx} {op} {openOp} onRowClick={allowPopup ? openDetails : openTxsPage} />
							{:else}
								<tr>
									<td colspan="100">Transaction #{id} with type {tx.type} is unsupported.</td>
								</tr>
							{/if}
						{/if}
					{/each}
				{/each}
			{:else if !loading}
				{#each Array(skeletonRowCount - 1) as _, i}
					<tr class="skeleton-row blurred-skeleton">
						<td><div class="skeleton-cell date"></div></td>
						<td><div class="skeleton-cell to-from"></div></td>
						<td><div class="skeleton-cell amount"></div></td>
						<td><div class="skeleton-cell token"></div></td>
						<td><div class="skeleton-cell type"></div></td>
					</tr>
				{/each}
			{/if}
			{#if loading}
				{#each Array(skeletonRowCount) as _, i}
					<tr class="skeleton-row">
						<td><div class="skeleton-cell date"></div></td>
						<td><div class="skeleton-cell to-from"></div></td>
						<td><div class="skeleton-cell amount"></div></td>
						<td><div class="skeleton-cell token"></div></td>
						<td><div class="skeleton-cell type"></div></td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
	{#if !$allTransactionsStore?.length && !loading}
		<div class={['no-transactions-overlay', { short: skeletonRowCount <= 5 }]}>
			<div class="no-transactions-message">No transactions found</div>
		</div>
	{/if}
</div>

<style>
	.scroll {
		overflow: auto;
		width: 100%;
		flex-grow: 1;
		position: relative;
	}
	table {
		width: 100%;
		border-spacing: 1rem 0.5rem;
		border-collapse: collapse;
		position: relative;
	}
	/* .loading {
		background-color: var(--neutral-bg-accent);
	} */
	.skeleton-cell {
		background-color: var(--neutral-bg-accent);
		border-radius: 0.5rem;
		height: 3rem;
		margin: 0.75rem 1rem;
		animation: pulse 2s ease-in-out infinite;
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

	.blurred-skeleton {
		filter: blur(2px);
		opacity: 0.3;
	}

	tbody.no-transactions-container {
		position: relative;
	}

	.no-transactions-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(to bottom, transparent 0%, var(--neutral-bg) 50%);
		pointer-events: none;
		z-index: 1;
	}

	.no-transactions-overlay.short {
		background: linear-gradient(to bottom, transparent 0%, var(--neutral-bg) 80%);
		align-items: end;
	}

	.no-transactions-message {
		font-weight: 500;
		padding: 1.5rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
