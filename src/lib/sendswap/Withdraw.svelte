<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import WithdrawOptions from './stages/withdraw/WithdrawOptions.svelte';
	import { type SendDetails, Network } from './utils/sendOptions';
	import { blankDetails, SendTxDetails } from './utils/sendUtils';
	import Complete from './stages/Complete.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { get } from 'svelte/store';

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
			toUsername: username,
			slippageBps: undefined
		};
	}

	// Snapshot SendTxDetails on open and restore on close so the
	// Withdraw dialog doesn't wipe QuickSwap's persisted selection
	// (all dashboard cards share the same global store).
	let snapshotBeforeWithdraw: SendDetails | null = null;
	$effect(() => {
		if (dialogOpen) {
			if (!snapshotBeforeWithdraw) {
				snapshotBeforeWithdraw = { ...get(SendTxDetails) };
			}
			sessionId;
			SendTxDetails.set(withdrawDetails());
		} else if (snapshotBeforeWithdraw) {
			SendTxDetails.set(snapshotBeforeWithdraw);
			snapshotBeforeWithdraw = null;
		}
	});
	$effect(() => {
		if (!auth || !dialogOpen) return;
		if (auth.value?.provider !== 'aioha') return;
		if ($SendTxDetails.toNetwork?.value === Network.btcMainnet.value) return;
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
				resetDetails={withdrawDetails}
				{stepsData}
				{extraProps}
				minHeight={512}
			/>
		{/if}
	{/snippet}
</Dialog>
