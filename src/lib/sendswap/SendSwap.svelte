<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import swapOptions, {
		Coin,
		Network,
		TransferMethod,
		type SendDetails
	} from '$lib/sendswap/utils/sendOptions';
	import { blankDetails, scanForBalance, SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import SwapOptions from './stages/SwapOptions.svelte';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Complete from '$lib/sendswap/stages/Complete.svelte';
	import TransferOptions from './stages/TransferOptions.svelte';
	import ReviewSwap from '$lib/sendswap/stages/ReviewSwap.svelte';
	import ReviewTransfer from './stages/ReviewTransfer.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';

	const { txType }: { txType: 'transfer' | 'swap' } = $props();

	const auth = $derived(getAuth()());
	function startDetails(): SendDetails {
		if (txType === 'swap') {
			return {
				...blankDetails(),
				toNetwork: Network.magi,
				method: TransferMethod.lightningTransfer
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

	const stepsData: MixedStepsArray = $derived(
		txType === 'swap'
			? [
					{ value: 'options', component: SwapOptions },
					{ value: 'review', component: ReviewSwap },
					{ value: 'complete', component: Complete }
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
