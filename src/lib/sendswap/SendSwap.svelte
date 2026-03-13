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
	import ReviewTransfer from './stages/ReviewTransfer.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';

	const { txType }: { txType: 'transfer' | 'swap' } = $props();

	const auth = $derived(getAuth()());
	function startDetails(): SendDetails {
		if (txType === 'swap') {
			const btcOpt = swapOptions.from.coins.find((c) => c.coin.value === Coin.btc.value);
			const hiveToOpt = swapOptions.to.coins.find((c) => c.coin.value === Coin.hive.value);
			return {
				...blankDetails(),
				toNetwork: Network.magi,
				method: TransferMethod.lightningTransfer,
				fromCoin: btcOpt,
				fromNetwork: Network.magi,
				toCoin: hiveToOpt
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
					{ value: 'review', component: SwapOptions },
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
