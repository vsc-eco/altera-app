<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import type { Transaction } from './sampleData';

	let { transactions }: { transactions: Transaction[] } = $props();
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
	<tbody>
		{#each transactions as { amount }}
			<tr>
				<!-- <td>
					{date}
				</td>
				<td>
					<Avatar src={avatarUrl} fallback=""></Avatar>
				</td>
				<td>
					{toFrom}
				</td> -->
				<td>
					{amount}
				</td>
				<!-- <td>
					{paymentMethod}
				</td> -->
			</tr>
		{/each}
	</tbody>
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
