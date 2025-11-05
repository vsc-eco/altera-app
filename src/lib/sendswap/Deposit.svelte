<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import DepositOptions from './stages/deposit/DepositOptions.svelte';
	import { Network, type SendDetails } from './utils/sendOptions';
	import { blankDetails, SendTxDetails } from './utils/sendUtils';
	import Complete from './stages/Complete.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';

	let {
		dialogOpen = $bindable(),
		toggle = $bindable(),
		sessionId
	}: {
		dialogOpen: boolean;
		toggle: (open?: boolean) => void;
		sessionId: number;
	} = $props();

	const auth = $derived(getAuth()());

	function depositDetails(): SendDetails {
		return {
			...blankDetails(),
			toNetwork: Network.magi,
			toUsername: getUsernameFromAuth(auth) ?? ''
		};
	}

	$effect(() => {
		sessionId;
		SendTxDetails.set(depositDetails());
	});
	$effect(() => {
		if (!auth || !dialogOpen) return;
		const username = getUsernameFromAuth(auth);
		if (username && username !== $SendTxDetails.toUsername) {
			$SendTxDetails.toUsername = username;
		}
	});

	// STEPS
	const stepsData: MixedStepsArray = [
		{ value: 'options', component: DepositOptions },
		{ value: 'review', component: ReviewSwap },
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
				txType="deposit"
				resetDetails={depositDetails}
				{stepsData}
				{extraProps}
				minHeight={512}
			/>
		{/if}
	{/snippet}
</Dialog>
