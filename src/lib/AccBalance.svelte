<script lang="ts">
	import { GetAccountBalanceStore } from '$houdini';
	import { untrack } from 'svelte';

	type Props = {
		did: string;
	}
	let { did }:Props = $props();

	let api = $derived(new GetAccountBalanceStore());
	$effect(() => {
		let intervalId = setInterval(() => {
			untrack(() => api)
				.fetch({ variables: { account: did } })
		}, 1000);
		return () => {
			clearInterval(intervalId);
		};
	});
</script>

<!-- <p>something</p> -->
{#if $api.data && $api.data.getAccountBalance}
	<table>
		<tbody>
			<tr>
				<th>HBD</th>
				<td>{$api.data.getAccountBalance?.hbd}</td>
			</tr>
			<tr class="section-end">
				<th>HBD Savings</th>
				<td>{$api.data.getAccountBalance?.hbd_savings}</td>
			</tr>
			<tr>
				<th>Hive</th>
				<td>{$api.data.getAccountBalance?.hive}</td>
			</tr>
			<tr>
				<th>Hive Consensus</th>
				<td>{$api.data.getAccountBalance?.hive_consensus}</td>
			</tr>
		</tbody>
	</table>
{/if}

<style>
	td {
		display: block;
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
		white-space: nowrap;
		text-align: right;
		padding-left: 0.25rem;
		padding-top: 0.5rem;
	}
	table {
		width: 100%;
	}
	@container table-row (width > 260px) {
		td {
			position: absolute;
			right: 0;
			bottom: 0.5rem;
		}
	}
	tr {
		container-type: inline-size;
		container-name: table-row;
		display: block;
		position: relative;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--neutral-bg-mid);
	}
	tr:last-child {
		border-bottom: none;
	}
	.section-end {
		border-bottom: 2px solid var(--neutral-fg-mid);
	}
	th {
		display: block;
		font-weight: bold;
		text-align: left;
		padding-right: 0.25rem;
	}
</style>
