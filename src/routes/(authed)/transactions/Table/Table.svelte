<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import { getAuth } from '$lib/auth/store';
	import { GetTransactionsStore } from '$houdini';
	// GetTransactions
	import moment from 'moment';
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import { browser } from '$app/environment';
	import mainnetSampleData from '../mainnetSampleData';
	import { Asset, type AssetSymbol } from '@hiveio/dhive';
	import getSampleData from '../getSampleData';
	import { ArrowLeft, ArrowRight } from '@lucide/svelte';
	import Date from './tds/Date.svelte';
	import ToFrom from './tds/ToFrom.svelte';
	import Amount from './tds/Amount.svelte';
	import Token from './tds/Token.svelte';
	import Type from './tds/Type.svelte';
	import Memo from './tds/Memo.svelte';
	import Status from './tds/Status.svelte';
	import Tr from './tr/Tr.svelte';

	let {
		did
	}: {
		did: string;
	} = $props();
	// let store = $derived(new GetTransactionsStore());
	// let data = $derived($store.data);
	let data = getSampleData(did);
	// $inspect($store.data);
	// $effect(() => {
	// 	if (!browser) return;
	// 	store.fetch({
	// 		variables: {
	// 			// limit: 5, // FIXME: add back once server properly supports pagination
	// 			did
	// 		}
	// 	});
	// });
	// let currStoreLen = $derived($store.data?.findLedgerTXs?.txs?.length);
	const auth = $derived(getAuth()());
	const START_BLOCK = 88079516;
	const START_BLOCK_TIME = moment('2024-08-16T02:46:48Z');

	function getDateFromBlockHeight(blockHeight: number) {
		const date =
			(blockHeight - START_BLOCK) * 3 < 0
				? START_BLOCK_TIME.clone().subtract(-(blockHeight - START_BLOCK) * 3, 'seconds')
				: START_BLOCK_TIME.clone().add((blockHeight - START_BLOCK) * 3, 'seconds');
		return date;
	}
</script>

<svelte:window
	onscroll={() => {
		if (
			document.documentElement.scrollHeight -
				document.documentElement.scrollTop -
				document.documentElement.clientHeight <
			1
		) {
			// store.loadNextPage() // FIXME: uncomment once backend properly supports pagination
		}
	}}
/>
<div class="scroll">
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
		{#if data}
			<tbody>
				{#each data as { data: { from, to, amount, asset: tk, memo, type: t }, anchr_height: { $numberLong: block_height }, id, status, required_auths: [owner], first_seen: { $date: first_seen }, anchr_block: block_id }}
					<!-- {#each data.findLedgerTXs as { from, to, amount, asset: tk, memo, type: t, block_height, id, status, owner, timestamp: first_seen }} -->
					<Tr
						{from}
						{to}
						{amount}
						{tk}
						{memo}
						{t}
						{block_height}
						{status}
						{did}
						{first_seen}
						{id}
					/>
				{/each}
			</tbody>
		{:else}
			<tbody>
				<tr><td colspan="100" class="loading">Loading..</td></tr>
			</tbody>
		{/if}
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
