<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import swapOptions, {
		Coin,
		Network,
		TransferMethod,
		type SendDetails
	} from '$lib/sendswap/utils/sendOptions';
	import { blankDetails, scanForBalance, SendTxDetails } from '$lib/sendswap/utils/sendUtils';
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

	const { txType }: { txType: 'transfer' | 'swap' } = $props();

	const auth = $derived(getAuth()());
	function startDetails(): SendDetails {
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
			return {
				...blankDetails(),
				toNetwork: toNet,
				method: TransferMethod.lightningTransfer,
				fromCoin: fromOpt,
				fromNetwork: fromNet,
				toCoin: toOpt
			};
		} else {
			const balOpt = scanForBalance(
				[Coin.hive, Coin.hbd, Coin.shbd].map((c) => ({
					coin: c,
					network: Network.magi
				}))
			);
			const coinOpt = swapOptions.from.coins.find((c) => c.coin.value === balOpt?.coin.value);

			return {
				...blankDetails(),
				toNetwork: Network.magi,
				fromNetwork: Network.magi,
				fromCoin: coinOpt,
				toCoin: coinOpt
			};
		}
	}

	SendTxDetails.set(startDetails());
	$effect(() => {
		// sets username for swap
		if (txType !== 'swap') return;
		if (auth.value) {
			const username = getUsernameFromAuth(auth);
			if (username) $SendTxDetails.toUsername = username;
		}
	});

	// Persist the user's source/target selection while on the swap page.
	// Uses its own localStorage key so the dashboard QuickSwap selection
	// stays independent.
	$effect(() => {
		if (txType !== 'swap') return;
		const fromCoin = $SendTxDetails.fromCoin?.coin.value;
		const fromNetwork = $SendTxDetails.fromNetwork?.value;
		const toCoin = $SendTxDetails.toCoin?.coin.value;
		const toNetwork = $SendTxDetails.toNetwork?.value;
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
	<StepsMachine size="page" {txType} resetDetails={startDetails} {stepsData} />
</div>

<style lang="scss">
	.send-internal-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
</style>
