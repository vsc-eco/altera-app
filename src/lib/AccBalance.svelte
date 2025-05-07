<script lang="ts">
	import { GetAccountBalanceStore } from '$houdini';
	import { untrack } from 'svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from './send/sendOptions';

	type Props = {
		did: string;
	}
	let { did }:Props = $props();

	let api = $derived(new GetAccountBalanceStore());
	let balances = $derived($api.data?.getAccountBalance ?? {
		hbd: 0,
		hbd_savings: 0,
		hive: 0,
		hive_consensus: 0
	})
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

<h2>VSC Balance</h2>
<div class="box">
	<table>
		<tbody>
			<tr>
				<td><img src = "{Coin.hbd.icon}" alt = ""></td>
				<td class = "coin-cell">HBD</td>
				<td class = "amount-cell">{new CoinAmount(balances.hbd, Coin.hbd, true).toPrettyString()}&nbsp</td>
			</tr>
			<tr>
				<th>
				<td><img src = "{Coin.hbd.icon}" alt = ""></td>
				<td class = "coin-cell">HBD Savings</td>
				<td class = "amount-cell">{new CoinAmount(balances.hbd_savings, Coin.hbd, true).toPrettyString()}&nbsp</td>
			</tr>
			<tr>
				<td><img src = "{Coin.hive.icon}" alt = ""></td>
				<td class = "coin-cell">Hive</td>
				<td class = "amount-cell">{new CoinAmount(balances.hive, Coin.hive, true).toPrettyString()}</td>
			</tr>
			<tr>
				<td class = "image-cell"><img src = "{Coin.hive.icon}" alt = ""></td>
				<td class = "coin-cell">Hive Consensus</td>
				<td class = "amount-cell">{new CoinAmount(balances.hive_consensus, Coin.hive, true).toPrettyString()}</td>
			</tr>
		</tbody>
	</table>
</div>


<style>
	img {
		width: 1.25rem;
		height: 1.25rem;	
	}
	td {
		width: fit-content;
		white-space: nowrap;
		vertical-align: middle;
	}
	table {
		width: 100%;
	}
	tr {
		container-type: inline-size;
		container-name: table-row;
		display: flex;
		padding: 1rem 0.5rem;
		margin: 0rem 0.5rem;
		border-bottom: 1px solid var(--neutral-bg-mid);
		min-width: 200px;
	}
	.coin-cell {
		width: fit-content;	
		font-weight: 500;
		text-align: left;
		padding-left: 0.5rem;
		min-width: 120px;
	}
	.amount-cell {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
		width: 100%;
		text-align: right;
	}
	tr:last-child {
		border-bottom: none;
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
