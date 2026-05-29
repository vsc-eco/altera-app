<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import { scanForBalance } from './utils/sendUtils';
	import Complete from './stages/Complete.svelte';
	import ReviewTransfer from './stages/ReviewTransfer.svelte';
	import { getFromOption, Coin, Network } from './utils/sendOptions';
	import QuickTransferOptions from './stages/QuickSendOptions.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import { TransferTxState, provideTxState } from './utils/txState.svelte';

	let {
		dialogOpen = $bindable(),
		toggle = $bindable(),
		sessionId
	}: {
		dialogOpen: boolean;
		toggle: (open?: boolean) => void;
		sessionId: number;
	} = $props();

	const txState = new TransferTxState();
	provideTxState(txState);

	function applyQuickDetails() {
		const balOpt = scanForBalance(
			[Coin.hive, Coin.hbd, Coin.shbd].map((c) => ({
				coin: c,
				network: Network.magi
			}))
		);
		const coinOpt = getFromOption(balOpt?.coin.value);
		txState.from = coinOpt ? { coin: coinOpt.coin, network: Network.magi } : undefined;
		txState.to = coinOpt ? { coin: coinOpt.coin, network: Network.magi } : undefined;
		txState.rail = Network.magi;
		txState.toUsername = '';
		txState.toDisplayName = '';
		txState.memo = '';
		txState.fromAmount = '0';
		txState.toAmount = '0';
	}

	// Only seed when the dialog opens — QuickSwap's state is now a separate
	// instance so there's no longer any cross-contamination.
	$effect(() => {
		if (!dialogOpen) return;
		sessionId;
		applyQuickDetails();
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
				resetState={applyQuickDetails}
				{extraProps}
				minHeight={632}
			/>
		{/if}
	{/snippet}
</Dialog>
