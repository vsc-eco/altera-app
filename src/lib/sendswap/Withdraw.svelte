<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import WithdrawOptions from './stages/withdraw/WithdrawOptions.svelte';
	import swapOptions, { Coin, Network, type SendDetails } from './utils/sendOptions';
	import { blankDetails, SendTxDetails } from './utils/sendUtils';
	import Complete from './stages/Complete.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';

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

	function withdrawDetails(): SendDetails {
		const username = auth.value?.provider === 'aioha' ? (getUsernameFromAuth(auth) ?? '') : '';
		return {
			...blankDetails(),
			toUsername: username
		};
	}

	// Only seed the SendTxDetails store when the Withdraw dialog actually
	// opens — otherwise this effect fires on every mount/render and wipes
	// out QuickSwap's persisted selection (sibling cards on the dashboard
	// all share the same global store).
	$effect(() => {
		if (!dialogOpen) return;
		sessionId;
		SendTxDetails.set(withdrawDetails());
	});
	$effect(() => {
		if (!auth || !dialogOpen) return;
		if (auth.value?.provider !== 'aioha') return;
		const username = getUsernameFromAuth(auth);
		if (username && username !== $SendTxDetails.toUsername) {
			$SendTxDetails.toUsername = username;
		}
	});

	// STEPS
	const stepsData: MixedStepsArray = [
		{ value: 'options', component: WithdrawOptions },
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
				txType="withdraw"
				resetDetails={withdrawDetails}
				{stepsData}
				{extraProps}
				minHeight={512}
			/>
		{/if}
	{/snippet}
</Dialog>
