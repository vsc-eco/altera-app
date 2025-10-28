<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import { blankDetails, SendTxDetails } from './utils/sendUtils';
	import Complete from './stages/Complete.svelte';
	import ReviewSend from './stages/ReviewSend.svelte';
	import { Network, TransferMethod } from './utils/sendOptions';
	import QuickSendOptions from './stages/QuickSendOptions.svelte';
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
		return {
			...blankDetails(),
			fromNetwork: Network.vsc,
			toNetwork: Network.vsc,
			method: TransferMethod.vscTransfer
		};
	}

	$effect(() => {
		sessionId;
		SendTxDetails.set(quickDetails());
	});

	// STEPS
	const stepsData: MixedStepsArray = [
		{ value: 'options', component: QuickSendOptions },
		{ value: 'review', component: ReviewSend },
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
