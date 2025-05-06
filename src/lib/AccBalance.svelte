<script lang="ts">
	import { GetAccountBalanceStore } from '$houdini';
	import { untrack } from 'svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from './send/sendOptions';

	type Props = {
		did: string;
	}
	let { did }:Props = $props();

	let hbd = $state(0);
	let hbd_savings = $state(0);
	let hive = $state(0);
	let hive_consensus = $state(0);

	let api = $derived(new GetAccountBalanceStore());
	$effect(() => {
		let intervalId = setInterval(() => {
			untrack(() => api)
				.fetch({ variables: { account: did } })
		}, 1000);
		if ($api.data && $api.data.getAccountBalance) {
			hbd = $api.data.getAccountBalance.hbd;
			hbd_savings = $api.data.getAccountBalance.hbd_savings;
			hive = $api.data.getAccountBalance.hive;
			hive_consensus = $api.data.getAccountBalance.hive_consensus;
		}

		return () => {
			clearInterval(intervalId);
		};
	});
</script>

<h2>Account Balance</h2>
<table>
	<tbody>
		<tr>
			<th>HBD</th>
			<td>{new CoinAmount(hbd, Coin.hbd, true)}</td>
		</tr>
		<tr>
			<th>HBD Savings</th>
			<td>{new CoinAmount(hbd_savings, Coin.hbd, true)}</td>
		</tr>
		<tr>
			<th>Hive</th>
			<td>{new CoinAmount(hive, Coin.hive, true)}</td>
		</tr>
		<tr>
			<th>Hive Consensus</th>
			<td>{new CoinAmount(hive_consensus, Coin.hive, true)}</td>
		</tr>
	</tbody>
</table>


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
	th {
		display: block;
		font-weight: bold;
		text-align: left;
		padding-right: 0.25rem;
	}
	h2 {
		position: sticky;
		font-size: var(--text-2xl);
		font-weight: 400;
		transform: translateY(-1rem);
		left: 0rem;
		overflow: visible;
	}
</style>
