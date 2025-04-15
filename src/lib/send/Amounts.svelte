<script lang="ts">
	import Amount from '$lib/currency/Amount.svelte';
	import { convert } from '$lib/currency/convert';
	import { untrack } from 'svelte';
	import { Coin, Network } from './sendOptions';
	let {
		fromAmount = $bindable(''),
		fromCoin: newFromCoin,
		fromNetwork,
		toAmount = $bindable(''),
		toCoin: newToCoin,
		toNetwork
	}: {
		fromAmount: string;
		fromCoin: Coin;
		fromNetwork: Network;
		toAmount: string;
		toCoin: Coin;
		toNetwork: Network;
	} = $props();
	let fromCoin: Coin = $state(undefined)!;
	let toCoin: Coin = $state(undefined)!;
	$effect(() => {
		if (untrack(() => fromCoin) == undefined) {
			fromCoin = newFromCoin;
			return;
		}
		convert(
			untrack(() => Number(fromAmount)),
			untrack(() => fromCoin!),
			newFromCoin,
			Network.lightning
		).then((amount) => {
			fromAmount = new Intl.NumberFormat('en-US', {
				style: 'decimal',
				maximumFractionDigits: 8
			})
				.format(amount)
				.replaceAll(',', '');
			fromCoin = newFromCoin;
		});
	});

	$effect(() => {
		if (untrack(() => toCoin) == undefined) {
			toCoin = newToCoin;
			return;
		}
		convert(
			untrack(() => Number(toAmount)),
			untrack(() => toCoin!),
			newToCoin,
			Network.lightning
		).then((amount) => {
			toAmount = new Intl.NumberFormat('en-US', {
				style: 'decimal',
				maximumFractionDigits: 8
			})
				.format(amount)
				.replaceAll(',', '');
			toCoin = newToCoin;
		});
	});
</script>

{#if fromCoin && toCoin}
	<Amount
		oninput={(v) => {
			convert(Number(fromAmount), fromCoin, toCoin, Network.lightning).then((value) => {
				toAmount = new Intl.NumberFormat('en-US', {
					style: 'decimal',
					maximumFractionDigits: 8
				})
					.format(value)
					.replaceAll(',', '');
			});
		}}
		required
		selectItems={fromCoin.unit == 'BTC' ? [fromCoin, Coin.sats, Coin.usd] : [fromCoin, Coin.usd]}
		id="from-amount"
		bind:originalAmount={fromAmount}
		coin={fromCoin}
		network={fromNetwork}
		label="From Amount:"
	/>

	<Amount
		oninput={(v) => {
			convert(Number(toAmount), toCoin, fromCoin, Network.lightning).then((value) => {
				fromAmount = new Intl.NumberFormat('en-US', {
					style: 'decimal',
					maximumFractionDigits: 8
				})
					.format(value)
					.replaceAll(',', '');
			});
		}}
		required
		selectItems={[toCoin]}
		id="to-amount"
		bind:originalAmount={toAmount}
		coin={toCoin}
		network={toNetwork}
		label="To Amount:"
	/>
{/if}
