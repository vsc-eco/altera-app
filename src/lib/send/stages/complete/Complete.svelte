<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/send/sendOptions';
	import moment from 'moment';
	import { SendTxDetails } from '$lib/send/sendUtils';

	let fromCoin = $derived($SendTxDetails.fromCoin?.coin ?? coins.unk);
	let inUsd = $state('');
	$effect(() => {
		new CoinAmount($SendTxDetails.fromAmount, fromCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toAmountString();
			});
	});
	let today = moment().format('MMM D, YYYY');
</script>

<div class="wrapper">
	<h2>Payment Complete</h2>
	<Card>
		<div class="amount">
			<span class="sm-caption">Payment to {$SendTxDetails.toDisplayName}</span>
			<h4>
				{new CoinAmount($SendTxDetails.fromAmount, fromCoin).toPrettyString()}
				{`(\$US ${inUsd})`}
			</h4>
		</div>
		<div class="date">
			<span>Paid on {today}</span>
		</div>
	</Card>
</div>

<style lang="scss">
	h4 {
		padding: 1.5rem 0;
		font-size: var(--text-6xl);
		// font-weight: 400;
		// color: var(--neutral-fg);
		margin: 0;
	}
	.date {
		padding: 1.5rem 0 1rem;
		border-top: 1px solid var(--neutral-bg-accent);
	}
	.sm-caption {
		font-size: var(--text-sm);
	}
</style>
