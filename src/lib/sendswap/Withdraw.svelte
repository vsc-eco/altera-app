<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import WithdrawOptions from './stages/withdraw/WithdrawOptions.svelte';
	import { Network } from './utils/sendOptions';
	import { WithdrawTxState, provideTxState } from './utils/txState.svelte';
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

	const txState = new WithdrawTxState();
	provideTxState(txState);

	function applyWithdrawDetails() {
		txState.toUsername = auth.value?.provider === 'aioha' ? (getUsernameFromAuth(auth) ?? '') : '';
		txState.fromCoin = undefined;
		txState.fromNetwork = undefined;
		txState.toCoin = undefined;
		txState.toNetwork = undefined;
		txState.fromAmount = '0';
		txState.toAmount = '0';
		txState.enteredAmount = '0';
		txState.fee = undefined;
		txState.account = undefined;
		txState.btcDeductFee = false;
		txState.btcMaxFee = undefined;
	}

	$effect(() => {
		if (!dialogOpen) return;
		sessionId;
		applyWithdrawDetails();
	});
	$effect(() => {
		if (!auth || !dialogOpen) return;
		if (auth.value?.provider !== 'aioha') return;
		if (txState.toNetwork?.value === Network.btcMainnet.value) return;
		const username = getUsernameFromAuth(auth);
		if (username && username !== txState.toUsername) {
			txState.toUsername = username;
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
				resetState={applyWithdrawDetails}
				{stepsData}
				{extraProps}
				minHeight={512}
			/>
		{/if}
	{/snippet}
</Dialog>
