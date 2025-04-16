<script lang="ts">
	import { getIntermediaryNetwork } from './getNetwork';
	import type { Coin, Network } from './sendOptions';
	type Props = {
		fromCoin: Coin;
		fromNetwork: Network;
		toCoin: Coin;
		toNetwork: Network;
		fromAmount: string;
		toAmount: string;
	};
	let { fromCoin, fromNetwork, toCoin, toNetwork, fromAmount, toAmount }: Props = $props();
</script>

{#await getIntermediaryNetwork({ coin: fromCoin, network: fromNetwork }, { coin: toCoin, network: toNetwork }).feeCalculation(Number(toAmount), toCoin, fromCoin)}
	loading fees...
{:then fee}
	<table>
		<tbody>
			<tr>
				<th>Subtotal</th>
				<td>{fromAmount} {fromCoin.unit}</td>
			</tr>
			<tr class="section-end">
				<th>Fee</th>
				<td>
					~{new Intl.NumberFormat('en-US', {
						style: 'decimal',
						minimumFractionDigits: 8,
						maximumFractionDigits: 8
					}).format(fee)}
					{fromCoin.unit}</td
				>
			</tr>
			<tr>
				<th>Send Total</th>
				<td>
					~{new Intl.NumberFormat('en-US', {
						style: 'decimal',
						minimumFractionDigits: 8,
						maximumFractionDigits: 8
					}).format(Number(fromAmount) + Number(fee))}
					{fromCoin.unit}</td
				>
			</tr>
			<tr>
				<th>Recv. Total</th>
				<td>
					{toAmount}
					{toCoin.unit}</td
				>
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
