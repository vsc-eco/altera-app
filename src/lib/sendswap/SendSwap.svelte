<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import swapOptions, { Coin, Network, TransferMethod } from '$lib/sendswap/utils/sendOptions';
	import { scanForBalance } from '$lib/sendswap/utils/sendUtils';
	import {
		SWAP_PAGE_PREF_KEY,
		loadSwapSelection,
		saveSwapSelection,
		findFromOpt,
		findToOpt,
		findNetwork
	} from '$lib/sendswap/utils/swapPersistence';
	import SwapOptions from './stages/SwapOptions.svelte';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Complete from '$lib/sendswap/stages/Complete.svelte';
	import TransferOptions from './stages/TransferOptions.svelte';
	import ReviewTransfer from './stages/ReviewTransfer.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import { SwapTxState, TransferTxState, provideTxState } from './utils/txState.svelte';
	import { untrack } from 'svelte';

	const { txType }: { txType: 'transfer' | 'swap' } = $props();

	const auth = $derived(getAuth()());

	// txType is a fixed string set by the parent route and never changes for the
	// lifetime of this component; use untrack to suppress the "captures initial
	// value" warning while still choosing the right state class at mount time.
	const txState = untrack(() => txType === 'swap' ? new SwapTxState() : new TransferTxState());
	provideTxState(txState);

	function applyStartDetails() {
		if (txType === 'swap') {
			const stored = loadSwapSelection(SWAP_PAGE_PREF_KEY);
			const fromOpt =
				findFromOpt(stored?.fromCoin) ??
				swapOptions.from.coins.find((c) => c.coin.value === Coin.btc.value);
			const toOpt =
				findToOpt(stored?.toCoin) ??
				swapOptions.to.coins.find((c) => c.coin.value === Coin.hive.value);
			const fromNet = findNetwork(stored?.fromNetwork) ?? Network.magi;
			const toNet = findNetwork(stored?.toNetwork) ?? Network.magi;
			txState.toNetwork = toNet;
			txState.method = TransferMethod.lightningTransfer;
			txState.fromCoin = fromOpt;
			txState.fromNetwork = fromNet;
			txState.toCoin = toOpt;
		} else {
			const balOpt = scanForBalance(
				[Coin.hive, Coin.hbd, Coin.shbd].map((c) => ({ coin: c, network: Network.magi }))
			);
			const coinOpt = swapOptions.from.coins.find((c) => c.coin.value === balOpt?.coin.value);
			txState.toNetwork = Network.magi;
			txState.fromNetwork = Network.magi;
			txState.fromCoin = coinOpt;
			txState.toCoin = coinOpt;
		}
	}

	applyStartDetails();

	$effect(() => {
		// sets username for swap
		if (txType !== 'swap') return;
		if (auth.value) {
			const username = getUsernameFromAuth(auth);
			if (username) txState.toUsername = username;
		}
	});

	// Persist the user's source/target selection while on the swap page.
	// Uses its own localStorage key so the dashboard QuickSwap selection
	// stays independent.
	$effect(() => {
		if (txType !== 'swap') return;
		const fromCoin = txState.fromCoin?.coin.value;
		const fromNetwork = txState.fromNetwork?.value;
		const toCoin = txState.toCoin?.coin.value;
		const toNetwork = txState.toNetwork?.value;
		// Only save once both sides are populated; partial state isn't useful.
		if (fromCoin && toCoin) {
			saveSwapSelection(SWAP_PAGE_PREF_KEY, { fromCoin, fromNetwork, toCoin, toNetwork });
		}
	});

	const stepsData: MixedStepsArray = $derived(
		txType === 'swap'
			? [
					{ value: 'options', component: SwapOptions },
					{ value: 'review', component: ReviewSwap, popup: true },
					{ value: 'complete', component: Complete, popup: true }
				]
			: [
					{ value: 'options', component: TransferOptions },
					{ value: 'review', component: ReviewTransfer },
					{ value: 'complete', component: Complete }
				]
	);
</script>

<div class="send-internal-wrapper">
	<StepsMachine size="page" {txType} resetState={applyStartDetails} {stepsData} />
</div>

<style lang="scss">
	.send-internal-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
</style>
