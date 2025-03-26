<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import type { Transaction } from './sampleData';
	import { getAuth } from '$lib/auth/store';
	import type { GetTransactions$input, GetTransactions$result, QueryResult } from '$houdini';
	import moment from 'moment';
	import { getAccountNameFromDid } from '$lib/getAccountName';
	let {
		transactions
	}: { transactions: Promise<QueryResult<GetTransactions$result, GetTransactions$input>> } =
		$props();

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

<table>
	<thead>
		<tr>
			<th>Date</th>
			<th>Avatar</th>
			<th>To/From</th>
			<th>Amount</th>
			<th>Payment Method</th>
		</tr>
	</thead>
	{#await transactions then transactions}
		{#if transactions.data}
			<tbody>
				{#each transactions.data.findLedgerTXs!.txs! as { amount, block_height, from, id, idx, status, owner, t, tk }}
					<tr>
						<td>
							{moment(getDateFromBlockHeight(block_height)).format('MMM D YYYY')}
						</td>
						<td>
							<!-- <Avatar src={avatarUrl} fallback=""></Avatar> -->
						</td>
						<td>
							{getAccountNameFromDid(from!)} to {getAccountNameFromDid(owner)}
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
		{/if}
	{/await}
</table>

<style>
	table {
		width: 100%;
	}
	th {
		text-align: left;
	}
	td {
		vertical-align: middle;
		padding: 0 min(1rem, 2%);

		border-bottom: 1px solid var(--neutral-bg-accent);
	}
</style>
