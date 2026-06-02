<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import WithdrawOptions from './stages/withdraw/WithdrawOptions.svelte';
	import { WithdrawTxState, provideTxState } from './utils/txState.svelte';
	import Complete from './stages/Complete.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
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

	const txState = new WithdrawTxState();
	provideTxState(txState);

	function applyWithdrawDetails() {
		txState.toUsername = '';
		txState.from = undefined;
		txState.to = undefined;
		txState.fromAmount = '0';
		txState.toAmount = '0';
		txState.fee = undefined;
		txState.deductFee = false;
		txState.maxFee = undefined;
	}

	$effect(() => {
		if (!dialogOpen) return;
		sessionId;
		applyWithdrawDetails();
	});
	// STEPS
	const stepsData: MixedStepsArray = [
		{ value: 'options', component: WithdrawOptions },
		{ value: 'review', component: ReviewSwap },
		{ value: 'complete', component: Complete }
	];

	let extraProps = $derived({
		close: toggle,
		onClose: toggle,
		compact: true
	});
</script>

<Dialog bind:toggle bind:open={dialogOpen}>
	{#snippet content()}
		{#if dialogOpen}
			<StepsMachine
				size="dialog"
				txType="withdraw"
				resetState={applyWithdrawDetails}
				{stepsData}
				{extraProps}
				minHeight={512}
			/>
		{/if}
	{/snippet}
</Dialog>
