<script lang="ts">
	import Amount from '$lib/currency/AmountInput.svelte';
	import { convert } from '$lib/currency/convert';
	import { untrack } from 'svelte';
	import { Coin, Network } from './sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	let {
		fromAmount = $bindable(''),
		fromCoin: newFromCoin,
		fromNetwork,
		toAmount = $bindable(''),
		toCoin: newToCoin,
		toNetwork,
		disabled
	}: {
		fromAmount: string;
		fromCoin?: Coin;
		fromNetwork?: Network;
		toAmount: string;
		toCoin?: Coin;
		toNetwork?: Network;
		disabled?: boolean;
	} = $props();
	let fromCoin: Coin = $state(Coin.unk);
	let toCoin: Coin = $state(Coin.unk);
	$effect(() => {
		if (newFromCoin == undefined) return;
		if (untrack(() => fromCoin.label) == Coin.unk.label) {
			console.log('HERE TO COIN TO NEW FROM COIN');
			new CoinAmount(
				untrack(() => Number(toAmount || '0')),
				untrack(() => toCoin)
			)
				.convertTo(newFromCoin, Network.lightning)
				.then((amount) => {
					fromAmount = amount.toAmountString();
					fromCoin = newFromCoin;
				});
			return;
		}
		new CoinAmount(
			untrack(() => Number(fromAmount)),
			untrack(() => fromCoin!)
		)
			.convertTo(newFromCoin, Network.lightning)
			.then((amount) => {
				fromAmount = amount.toAmountString();
				fromCoin = newFromCoin;
			});
	});

	$effect(() => {
		if (newToCoin == undefined) return;
		if (untrack(() => toCoin.label) == Coin.unk.label) {
			console.log('HERE FROM COIN TO NEW TO COIN');
			new CoinAmount(
				untrack(() => Number(fromAmount || '0')),
				untrack(() => fromCoin)
			)
				.convertTo(newToCoin, Network.lightning)
				.then((amount) => {
					toAmount = amount.toAmountString();
					toCoin = newToCoin;
				});
			return;
		}
		new CoinAmount(
			untrack(() => Number(toAmount)),
			untrack(() => toCoin!)
		)
			.convertTo(newToCoin, Network.lightning)
			.then((amount) => {
				toAmount = amount.toAmountString();
				toCoin = newToCoin;
			});
	});
</script>

{#if fromCoin && toCoin}
	<Amount
		oninput={(v) => {
			new CoinAmount(Number(fromAmount), fromCoin)
				.convertTo(toCoin, Network.lightning)
				.then((value) => {
					toAmount = value.toAmountString();
				});
		}}
		{disabled}
		required
		selectItems={fromCoin.unit == 'BTC' ? [fromCoin, Coin.sats, Coin.usd] : [fromCoin, Coin.usd]}
		id="from-amount"
		bind:originalAmount={fromAmount}
		coin={fromCoin}
		network={fromNetwork ?? Network.unknown}
		label="From Amount:"
	/>

	<Amount
		oninput={(v) => {
			new CoinAmount(Number(toAmount), toCoin)
				.convertTo(fromCoin, Network.lightning)
				.then((value) => {
					fromAmount = value.toAmountString();
				});
		}}
		{disabled}
		required
		selectItems={[toCoin]}
		id="to-amount"
		bind:originalAmount={toAmount}
		coin={toCoin}
		network={toNetwork ?? Network.unknown}
		label="To Amount:"
	/>
{/if}
