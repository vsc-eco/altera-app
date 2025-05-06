<script lang="ts">
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getIntermediaryNetwork } from './getNetwork';
	import type { Network, UnknownCoin } from './sendOptions';
	type Props = {
		fromCoin: UnknownCoin;
		fromNetwork: Network;
		toCoin: UnknownCoin;
		toNetwork: Network;
		fromAmount: string;
		toAmount: string;
	};
	let { fromCoin, fromNetwork, toCoin, toNetwork, fromAmount, toAmount }: Props = $props();
</script>

{#await getIntermediaryNetwork({ coin: fromCoin, network: fromNetwork }, { coin: toCoin, network: toNetwork }).feeCalculation(new CoinAmount(Number(toAmount), toCoin), fromCoin)}
	loading fees...
{:then fee}
	{@const from = new CoinAmount(fromAmount, fromCoin)}
	{@const to = new CoinAmount(toAmount, toCoin)}
	<table>
		<tbody>
			<tr>
				<th>Subtotal</th>
				<td>{from.toPrettyString()}</td>
			</tr>
			<tr class="section-end">
				<th>Fee</th>
				<td> ~{fee.toPrettyString()}</td>
			</tr>
			<tr>
				<th>Send Total</th>
				<td> ~{fee.add(from).toPrettyString()}</td>
			</tr>
			<tr>
				<th>Recv. Total</th>
				<td> {to.toPrettyString()}</td>
			</tr>
		</tbody>
	</table>
{/await}

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
