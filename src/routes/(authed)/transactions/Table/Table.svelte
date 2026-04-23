<script lang="ts">
	import Tr from './tr/Tr.svelte';
	import { onMount, type Snippet } from 'svelte';
	import {
		allTransactionsStore,
		magiTxsStore,
		fetchTxs,
		waitForExtend,
		fetchBtcDeposits,
		type TxListItem,
		type TransactionOpType
	} from '$lib/stores/txStores';
	import { goto } from '$app/navigation';
	import SidePopup from '$lib/components/SidePopup.svelte';
	import ContractTr from './tr/ContractTr.svelte';
	import BtcMappingTr from './tr/BtcMappingTr.svelte';
	import BtcDepositTr from './tr/BtcDepositTr.svelte';

	let {
		did,
		allowPopup = true,
		initialOpen,
		limit: limitProp,
		size = 'full'
	}: {
		did: string;
		allowPopup?: boolean;
		initialOpen?: [string, number];
		limit?: number;
		size?: 'small' | 'full';
	} = $props();
	let loading = $state(true);
	let lastLength = $state(0);
	let currStoreLen = $derived($allTransactionsStore.length);
	let hitBottom = $derived(lastLength === currStoreLen);

	const displayTxs = $derived(
		limitProp != null
			? ($allTransactionsStore ?? []).slice(0, limitProp)
			: ($allTransactionsStore ?? [])
	) as TxListItem[];

	// Routing: determine which TR component to render for a VSC op.
	type OpTrType = 'regular' | 'btc-vsc' | 'contract';
	function getOpTrType(op: TransactionOpType): OpTrType | null {
		const { data } = op;
		if (new Set(['from', 'to', 'asset', 'amount']).isSubsetOf(new Set(Object.keys(data)))) {
			return 'regular';
		}
		if (op.type === 'call_contract' || op.type === 'call') {
			const action: string = op.data?.action || '';
			if (action === 'unmap' || action === 'transfer' || action === 'transferFrom') {
				return 'btc-vsc';
			}
			if (action === 'increaseAllowance') return null;
			return 'contract';
		}
		return null;
	}

	function updateAll() {
		fetchTxs(did, 'update', (val) => (loading = val));
		fetchBtcDeposits(did, 'update');
	}

	let skeletonRowCount = $state(8);
	onMount(() => {
		const fetchLimit = limitProp ?? 20;
		if (!initialOpen && $allTransactionsStore.length < fetchLimit) {
			fetchTxs(did, 'set', (val) => (loading = val), fetchLimit);
			fetchBtcDeposits(did, 'set', fetchLimit);
		}
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

	// this assumes that did doesn't change, and is not reactive to did
	// just runs once when the page loads and again if too many new transactions
	// are added (called explicitly below)
	let hasFoundAutoOpenTx = false;
	async function loadUntilTxFound(targetTxId: string) {
		if (!targetTxId || hasFoundAutoOpenTx) return;

		while (!hasFoundAutoOpenTx) {
			// Check if the transaction is already in the current store
			const currentTxs = $magiTxsStore;
			const foundTx = currentTxs.find((tx) => tx.id === targetTxId);

			let lastOffset = currStoreLen;

			if (foundTx) {
				hasFoundAutoOpenTx = true;
				// Scroll to the transaction after a brief delay to ensure DOM is updated
				setTimeout(() => {
					const txElement = document.querySelector(`[data-tx-id="${targetTxId}"]`);
					if (txElement) {
						txElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
						if (txElement instanceof HTMLElement) {
							txElement.click();
						}
					}
				}, 100);
				break;
			}

			loading = true;
			try {
				const success = await waitForExtend(did);
				if (!success) break;
			} catch (error) {
				if (error instanceof Error && error.name !== 'AbortError') {
					console.error(error);
				}
				break;
			}
			if (currStoreLen === lastOffset) {
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
		const intervalId = setInterval(updateAll, 2000);
		return () => clearInterval(intervalId);
	});
	let openOp: [string, number] | null = $state(null);
	let openSnippet: (() => ReturnType<Snippet>) | undefined = $state();
	let popopOpen = $state(false);
	function toggleDetails(op: [string, number], content: () => ReturnType<Snippet>) {
		if (!allowPopup) {
			openTxsPage(op);
			return;
		}
		if (openOp && openOp[0] === op[0] && openOp[1] === op[1]) {
			openOp = null;
			openSnippet = undefined;
			popopOpen = false;
		} else {
			openOp = op;
			openSnippet = content;
			popopOpen = true;
		}
	}
	function openTxsPage(op: [string, number]) {
		const openTxParams = new URLSearchParams();
		openTxParams.set('tx', op[0]);
		openTxParams.set('index', op[1].toString());
		goto(`/transactions?${openTxParams.toString()}`);
	}
</script>

<div class={['card', { small: size === 'small' }]}>
	<div class="table-scroll">
	<div class="header-row">
		<div class="h h-date">Date</div>
		<div class="h h-to-from">To/From</div>
		<div class="h h-status">Status</div>
		<div class="h h-amount">Amount</div>
		<div class="h h-type">Type</div>
	</div>
	<div
		class="body-scroll"
		onscroll={(e) => {
			if (limitProp != null) return;
			const me = e.currentTarget;
			if (me.scrollHeight - me.scrollTop - me.clientHeight <= 1 && !hitBottom && !loading) {
				lastLength = currStoreLen;
				fetchTxs(did, 'extend', (val) => (loading = val), 12);
				fetchBtcDeposits(did, 'extend', 12);
			}
		}}
	>
		<table>
			<tbody
				id="transactions-tbody"
				class={!displayTxs?.length && !loading ? 'no-transactions-container' : ''}
			>
				{#if displayTxs && displayTxs.length > 0}
					<!-- {#each $allTransactionsStore as tx (tx.id)}
					{@const { ops, id } = tx}
					{#each ops!.sort((a, b) => {
						// put deposits below other ops in their transaction
						return (a?.type === 'deposit' ? 1 : 0) - (b?.type === 'deposit' ? 1 : 0);
					}) as op}
						{#if op}
							{@const { data } = op}
							{#if new Set( ['from', 'to', 'asset', 'amount'] ).isSubsetOf(new Set(Object.keys(data)))}
								<Tr {tx} {op} onRowClick={allowPopup ? toggleDetails : openTxsPage} />
							{/if}
						{/if}
					{/each}
				{/each} -->
					{#each displayTxs as item (item.kind === 'vsc' ? item.tx.id : item.event.indexer_tx_hash)}
						{#if item.kind === 'btc-deposit'}
							<BtcDepositTr event={item.event} onRowClick={toggleDetails} />
						{:else}
							{@const tx = item.tx}
							{@const { ops } = tx}
							<!--
								Always iterate the full `ops` array so every
								operation in a transaction renders as its own
								row. Previously contract transactions collapsed
								to a single ledger-derived row, which hid
								companion ops like `increaseAllowance` that
								happen alongside `execute`.

								Sort order: op index descending (higher op
								numbers on top, so op 1 renders above op 0),
								with a deposit-last override retained inside
								each op-index group.
							-->
							{#each [...(ops ?? [])].sort((a, b) => {
								const depDiff = (a?.type === 'deposit' ? 1 : 0) - (b?.type === 'deposit' ? 1 : 0);
								if (depDiff !== 0) return depDiff;
								return (b?.index ?? 0) - (a?.index ?? 0);
							}) as op, i (`${tx.id}-${op?.index ?? i}`)}
								{#if op}
									{@const trType = getOpTrType(op)}
									{#if trType === 'regular'}
										<Tr {tx} {op} onRowClick={toggleDetails} />
									{:else if trType === 'btc-vsc'}
										<BtcMappingTr {tx} {op} onRowClick={toggleDetails} />
									{:else if trType === 'contract'}
										<ContractTr {tx} {op} onRowClick={toggleDetails} />
									{/if}
								{/if}
							{/each}
						{/if}
					{/each}
				{:else if !loading}
					{#each Array(skeletonRowCount - 1) as _, i}
						<tr class="skeleton-row blurred-skeleton">
							<td><div class="skeleton-cell date"></div></td>
							<td><div class="skeleton-cell to-from"></div></td>
							<td><div class="skeleton-cell status"></div></td>
							<td><div class="skeleton-cell amount"></div></td>
							<td><div class="skeleton-cell type"></div></td>
						</tr>
					{/each}
				{/if}
				{#if loading}
					{#each Array(skeletonRowCount) as _, i}
						<tr class="skeleton-row">
							<td><div class="skeleton-cell date"></div></td>
							<td><div class="skeleton-cell to-from"></div></td>
							<td><div class="skeleton-cell status"></div></td>
							<td><div class="skeleton-cell amount"></div></td>
							<td><div class="skeleton-cell type"></div></td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
		{#if !displayTxs?.length && !loading}
			<div class={['no-transactions-overlay', { short: skeletonRowCount <= 5 }]}>
				<div class="no-transactions-message">No transactions found</div>
			</div>
		{/if}
	</div>
	</div>
</div>

<SidePopup
	toggle={() => {
		openOp = null;
		openSnippet = undefined;
		popopOpen = false;
	}}
	content={openSnippet}
	open={popopOpen}
	defaultOpen={false}
/>

<style lang="scss">
	.card {
		display: flex;
		flex-direction: column;
		width: 100%;
		flex-grow: 1;
		min-height: 0;
		position: relative;
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1.25rem;
		font-family: 'Nunito Sans', sans-serif;
		/* overflow: clip preserves the border-radius visual clipping without
		   blocking the child .table-scroll from showing its horizontal scrollbar. */
		overflow: hidden; /* fallback for older browsers */
		overflow: clip;
	}
	.table-scroll {
		display: grid;
		grid-template-columns:
			minmax(5rem, 1fr)
			minmax(12rem, 2fr)
			minmax(8rem, 1fr)
			minmax(min-content, 1fr)
			minmax(min-content, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
		flex: 1;
		min-height: 0;
		overflow-x: auto;
	}
	.header-row {
		display: contents;
	}
	.h {
		grid-row: 1;
		padding: 0.75rem 1rem;
		color: var(--dash-text-muted);
		font-weight: 600;
		font-size: 0.8rem;
		text-align: left;
		border-bottom: 1px solid var(--dash-divider);
	}
	.h-to-from {
		text-align: left;
	}
	.h-status,
	.h-amount,
	.h-type {
		text-align: center;
	}
	.body-scroll {
		grid-row: 2;
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		grid-auto-rows: min-content;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		position: relative;
	}
	.body-scroll > table,
	.body-scroll > table > :global(tbody) {
		display: contents;
	}
	.body-scroll :global(tr) {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
	}
	.skeleton-cell {
		background-color: var(--dash-surface-alt);
		border-radius: 12px;
		height: 3rem;
		margin: 0.75rem 1rem;
		animation: pulse 2s ease-in-out infinite;
	}
	.body-scroll :global(td) {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		border-bottom: 1px solid var(--dash-divider);
		color: var(--dash-text-primary);
	}
	.body-scroll :global(tr:last-child td) {
		border-bottom: none;
	}
	.body-scroll :global(.to-from) {
		padding: 0.75rem 0;
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
		background: linear-gradient(to bottom, transparent 10%, var(--dash-bg) 60%);
		pointer-events: none;
		z-index: 1;
	}

	.no-transactions-overlay.short {
		background: linear-gradient(to bottom, transparent 10%, var(--dash-bg) 80%);
		align-items: end;
	}

	.no-transactions-message {
		font-weight: 500;
		padding: 1.5rem;
		color: var(--dash-text-secondary);
	}

	/* Small variant for dashboard embed */
	.card.small {
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: transparent;
		font-size: 0.8rem;
		overflow: visible;
	}
	.card.small .h {
		padding: 0.5rem 1rem 0.5rem 1.35rem;
		font-size: 0.75rem;
	}
	.card.small .body-scroll :global(td) {
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
	}
	.card.small .skeleton-cell {
		height: 2rem;
		margin: 0.5rem 0.75rem;
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

	@media (max-width: 600px) {
		.table-scroll {
			grid-template-columns:
				minmax(12rem, 2fr)
				minmax(8rem, 1fr)
				minmax(min-content, 1fr)
				minmax(min-content, 1fr);
		}
		.h-date {
			display: none;
		}
		.body-scroll :global(td:first-child) {
			display: none;
		}
	}
</style>
