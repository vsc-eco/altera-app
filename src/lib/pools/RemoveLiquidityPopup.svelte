<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import type { PoolRow, MyPoolRow } from '$lib/pools/poolsData';
	import { getAuth } from '$lib/auth/store';
	import { removeLiquidityTx } from '$lib/magiTransactions/hive';
	import { get } from 'svelte/store';
	import StepsMachine, { type MixedStepsArray } from '$lib/sendswap/StepsMachine.svelte';
	import RemoveLiquidityOptions from '$lib/pools/stages/RemoveLiquidityOptions.svelte';
	import RemoveLiquidityReview from '$lib/pools/stages/RemoveLiquidityReview.svelte';
	import RemoveLiquidityComplete from '$lib/pools/stages/RemoveLiquidityComplete.svelte';
	import { removeLiquidityDraftStore, resetRemoveLiquidityDraft } from '$lib/pools/removeLiquidityStore';

	let {
		open = $bindable(false),
		toggle = $bindable(),
		pools,
		myPools = [],
		preselectedPool = null
	}: {
		open?: boolean;
		toggle?: (o?: boolean) => void;
		pools: PoolRow[];
		myPools?: MyPoolRow[];
		preselectedPool?: PoolRow | null;
	} = $props();
	let dialogToggle = $state<(o?: boolean) => void>(() => {});
	const auth = $derived(getAuth()());

	$effect(() => {
		if (open) {
			dialogToggle(true);
			resetRemoveLiquidityDraft();
			if (preselectedPool) {
				removeLiquidityDraftStore.update((d) => ({
					...d,
					selectedPool: preselectedPool
				}));
			}
		}
	});

	const stepsData: MixedStepsArray = [
		{ value: 'options', component: RemoveLiquidityOptions },
		{ value: 'review', component: RemoveLiquidityReview },
		{ value: 'complete', component: RemoveLiquidityComplete }
	];

	async function submitRemoveLiquidity(setStatus: (s: string, isError?: boolean) => void) {
		if (!auth.value?.aioha || !auth.value?.username) {
			setStatus('Error: not authenticated.', true);
			return new Error('Not authenticated');
		}

		const draft = get(removeLiquidityDraftStore);
		if (!draft.selectedPool) {
			setStatus('Please select a pool.', true);
			return new Error('No pool selected');
		}
		if (draft.hasError || draft.lpAmount <= 0) {
			setStatus('lp_amount must be a positive integer.', true);
			return new Error('Invalid lp_amount');
		}

		setStatus('Waiting for Hive wallet approval…');
		const res = await removeLiquidityTx(draft.lpAmount, auth.value.username, auth.value.aioha, draft.selectedPool);
		if (!res.success) {
			setStatus(res.error ?? 'Transaction failed', true);
			return new Error(res.error ?? 'Transaction failed');
		}
		setStatus('Transaction submitted. You will be notified when your transaction is finished.');
		return { id: res.result };
	}
</script>

<Dialog bind:open bind:toggle={dialogToggle}>
	{#snippet title()}
		Remove Liquidity
	{/snippet}
	{#snippet content()}
		<StepsMachine
			size="dialog"
			txType="remove liquidity"
			{stepsData}
			onSubmit={submitRemoveLiquidity}
			extraProps={{ pools, myPools, close: dialogToggle, onClose: () => dialogToggle(false) }}
		/>
	{/snippet}
</Dialog>
