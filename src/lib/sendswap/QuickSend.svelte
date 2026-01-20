<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import { blankDetails, scanForBalance, SendTxDetails } from './utils/sendUtils';
	import Complete from './stages/Complete.svelte';
	import ReviewTransfer from './stages/ReviewTransfer.svelte';
	import swapOptions, { Coin, Network, TransferMethod } from './utils/sendOptions';
	import QuickTransferOptions from './stages/QuickSendOptions.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';

	let {
		dialogOpen = $bindable(),
		toggle = $bindable(),
		sessionId
	}: {
		dialogOpen: boolean;
		toggle: (open?: boolean) => void;
		sessionId: number;
	} = $props();

	function quickDetails() {
		const balOpt = scanForBalance(
			[Coin.hive, Coin.hbd, Coin.shbd].map((c) => ({
				coin: c,
				network: Network.magi
			}))
		);
		const coinOpt = swapOptions.from.coins.find((c) => c.coin.value === balOpt?.coin.value);
		return {
			...blankDetails(),
			fromCoin: coinOpt,
			fromNetwork: Network.magi,
			toCoin: coinOpt,
			toNetwork: Network.magi,
			method: TransferMethod.magiTransfer
		};
	}

	$effect(() => {
		sessionId;
		SendTxDetails.set(quickDetails());
	});

	// STEPS
	const stepsData: MixedStepsArray = [
		{ value: 'options', component: QuickTransferOptions },
		{ value: 'review', component: ReviewTransfer },
		{ value: 'complete', component: Complete }
	];

	let extraProps = $derived({
		onClose: toggle,
		compact: true
	});
</script>

<Dialog bind:toggle bind:open={dialogOpen}>
	{#snippet content()}
		{#if dialogOpen}
			<StepsMachine
				size="dialog"
				txType="send"
				{stepsData}
				resetDetails={quickDetails}
				{extraProps}
				minHeight={632}
			/>
		{/if}
	{/snippet}
</Dialog>
