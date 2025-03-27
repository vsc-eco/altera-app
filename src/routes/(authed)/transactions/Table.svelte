<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import { getAuth } from '$lib/auth/store';
	import { GetTransactionsStore } from '$houdini';
	// GetTransactions
	import moment from 'moment';
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import { browser } from '$app/environment';

	let {
		did
	}: {
		did: string;
	} = $props();
	let store = $derived(new GetTransactionsStore());
	let data = $derived($store.data);
	$inspect($store.data);
	$effect(() => {
		if (!browser) return;
		store.fetch({
			variables: {
				// limit: 5, // FIXME: add back once server properly supports pagination
				did
			}
		});
	});
	let currStoreLen = $derived($store.data?.findLedgerTXs?.txs?.length);
	const auth = $derived(getAuth()());
	$inspect(auth.value?.did);
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

<table>
	<thead>
		<tr>
			<th>Date</th>
			<th>To/From</th>
			<th>Amount</th>
			<th>Type</th>
		</tr>
	</thead>
	{#if data}
		<tbody>
			{#each data.findLedgerTXs!.txs! as { amount, block_height, from, id, idx, status, owner, t, tk }}
				{@const [otherAccount, fromOrTo] = owner == did ? [from!, 'From'] : [owner!, 'To']}
				<tr>
					<td>
						{getDateFromBlockHeight(block_height).format('MMM D')}
					</td>
					<td class="to-from">
						<Avatar did={otherAccount} fallback=""></Avatar>
						{fromOrTo}
						{getAccountNameFromDid(otherAccount)}
					</td>
					<td>
						{amount}
						{tk}
					</td>
					<td>
						{t}
					</td>
				</tr>
			{/each}
		</tbody>
	{:else}
		<tbody>
			<tr><td colspan="10" class="loading">Loading..</td></tr>
		</tbody>
	{/if}
</table>

<style>
	table {
		width: 100%;
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
		padding: 0.5rem 0;
	}
	td {
		vertical-align: middle;
		padding: 1rem min(1rem, 2%);

		border-bottom: 1px solid var(--neutral-bg-accent);
	}

	.to-from {
		display: flex;

		justify-content: left;
		gap: 0.25rem;
		align-items: center;
	}
</style>
