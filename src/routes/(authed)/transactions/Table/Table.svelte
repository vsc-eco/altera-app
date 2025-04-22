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
	import { untrack } from 'svelte';
	let {
		did
	}: {
		did: string;
	} = $props();
	let store = $derived(new GetTransactionsStore());
	let txs: {
		readonly id: string;
		readonly amount: any;
		readonly block_height: any;
		readonly timestamp: string;
		readonly from: string;
		readonly owner: string;
		readonly type: string;
		readonly asset: string;
		readonly tx_id: string;
	}[] = $state([]);
	let loading = $state(true);
	// let data = getSampleData(did);
	$inspect($store.data);
	$effect(() => {
		untrack(() => store)
			.fetch({
				variables: {
					limit: 12, // FIXME: add back once server properly supports pagination
					did
				}
			})
			.then((posts) => {
				loading = false;
				if (!posts.data?.findLedgerTXs) return;
				txs = untrack(() => txs).concat(posts.data?.findLedgerTXs);
			});
	});
	let currStoreLen = $derived(txs.length);
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

<div
	class="scroll"
	onscroll={(e) => {
		const me = e.currentTarget;
		if (me.scrollHeight - me.scrollTop - me.clientHeight < 1) {
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
					if (!posts.data?.findLedgerTXs) return;
					txs = untrack(() => txs).concat(posts.data?.findLedgerTXs);
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
			<!-- {#each data as { data: { from, to, amount, asset: tk, memo, type: t }, anchr_height: { $numberLong: block_height }, id, status, required_auths: [owner], first_seen: { $date: first_seen }, anchr_block: block_id }} -->
			<!-- Missing memo and status !! -->
			{#each txs as { from, owner: to, amount, asset: tk, type: t, block_height, id, timestamp: first_seen }}
				{@const amountStr = amount.toString()}
				<Tr {from} {to} amount={amountStr} {tk} {t} {block_height} {did} {first_seen} {id} />
			{/each}
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
