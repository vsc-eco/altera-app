<script lang="ts">
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { CornerDownRight } from '@lucide/svelte';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';

	let {
		fromSwapAmount = $bindable(),
		toAmount = $bindable()
	}: {
		fromSwapAmount: string;
		toAmount: string;
	} = $props();
</script>

<div class="swap-wrapper">
	<CornerDownRight />
	<div class="swap-options">
		<h3>Swap Options</h3>
		<span class="sm-caption">From Asset</span>
		<div class="amt-and-fees">
			<div class="to-amount">
				<BasicAmountInput
					bind:amount={fromSwapAmount}
					coin={$SendTxDetails.fromCoin}
					network={$SendTxDetails.fromNetwork}
					id={'from-amt'}
					connectedCoinAmount={$SendTxDetails.toCoin
						? new CoinAmount(toAmount, $SendTxDetails.toCoin.coin)
						: undefined}
				/>
			</div>
			{#if $SendTxDetails.fee}
				{@const fee = $SendTxDetails.fee}
				<table>
					<tbody>
						<tr>
							<th>Fee:</th>
							<td>~{fee.toPrettyString()}</td>
						</tr>
						<tr>
							<th>Send Total:</th>
							<td
								>~{fee
									.add(new CoinAmount($SendTxDetails.fromAmount, $SendTxDetails.fromCoin!.coin))
									.toPrettyString()}</td
							>
						</tr>
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.swap-wrapper {
		display: flex;
		margin-top: 1rem;
		width: 100%;
		.swap-options {
			.amt-and-fees {
				display: flex;
				justify-content: space-between;
			}
			padding-left: 1rem;
			width: 100%;
			h3 {
				margin-top: 0;
				color: var(--neutral-fg);
				font-size: var(--text-base);
				margin-bottom: 0.5rem;
				font-weight: 450;
			}
			display: flex;
			flex-direction: column;
			.sm-caption {
				padding-bottom: 0.5rem;
			}
			.to-amount {
				max-width: 50%;
				flex-grow: 1;
			}
			// .coin-select {
			// 	width: fit-content;
			// }
			td {
				display: block;
				font-family: 'Noto Sans Mono Variable', monospace;
				font-weight: 400;
				white-space: nowrap;
				text-align: right;
				padding-left: 0.5rem;
			}
			th {
				flex-grow: 1;
				display: block;
				font-weight: bold;
				text-align: right;
				padding-right: 0.25rem;
			}
			tr {
				padding: 0.25rem 0;
				display: flex;
				align-items: center;
			}
		}
	}
</style>
