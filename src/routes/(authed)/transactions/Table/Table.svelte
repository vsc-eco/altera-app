<script lang="ts">
	import { GetTransactionsStore, type GetTransactions$result } from '$houdini';
	// GetTransactions
	import moment from 'moment';
	import Tr from './tr/Tr.svelte';
	import { untrack } from 'svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/send/sendOptions';
	let {
		did
	}: {
		did: string;
	} = $props();
	let store = $derived(new GetTransactionsStore());
	let txs: NonNullable<GetTransactions$result['findTransaction']> = $state([]);
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
				if (!posts.data?.findTransaction) return;
				txs = untrack(() => txs).concat(posts.data?.findTransaction);
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
					txs = untrack(() => txs).concat(posts.data?.findTransaction);
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
			{#if txs && txs.length != 0}
				{#each txs as { ledger, data, anchr_height: block_height, anchr_ts: anchor_ts, id }}
					{#if ledger?.length != 0}
						{#each ledger! as { from, to, amount, asset: tk, type: t }}
							<Tr
								{anchor_ts}
								{from}
								{to}
								amount={new CoinAmount(amount, Coin[tk.split('_')[0] as keyof typeof Coin], true)}
								{t}
								{block_height}
								{did}
								{id}
							/>
						{/each}
					{:else if new Set( ['from', 'to', 'type', 'asset', 'amount'] ).isSubsetOf(new Set(Object.keys(data)))}
						<Tr
							{anchor_ts}
							from={data.from}
							to={data.to}
							amount={new CoinAmount(
								data.amount,
								Coin[data.asset.split('_')[0] as keyof typeof Coin],
								false
							)}
							t={data.type}
							{block_height}
							{did}
							{id}
						/>
					{:else}
						<tr
							><td colspan="100">Transaction with id {id} and type {data.type} is unsupported.</td
							></tr
						>
					{/if}
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
