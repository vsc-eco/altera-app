<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import type { PoolRow } from '$lib/pools/poolsData';
	import { getAuth } from '$lib/auth/store';
	import { addLiquidityTx } from '$lib/magiTransactions/hive';
	import { get } from 'svelte/store';
	import StepsMachine, { type MixedStepsArray } from '$lib/sendswap/StepsMachine.svelte';
	import AddLiquidityOptions from '$lib/pools/stages/AddLiquidityOptions.svelte';
	import AddLiquidityReview from '$lib/pools/stages/AddLiquidityReview.svelte';
	import AddLiquidityComplete from '$lib/pools/stages/AddLiquidityComplete.svelte';
	import { liquidityDraftStore, resetLiquidityDraft } from '$lib/pools/liquidityStore';

	let {
		open = $bindable(false),
		toggle = $bindable(),
		pools,
		preselectedPool = null
	}: {
		open?: boolean;
		toggle?: (o?: boolean) => void;
		pools: PoolRow[];
		preselectedPool?: PoolRow | null;
	} = $props();

	let dialogToggle = $state<(o?: boolean) => void>(() => {});
	const auth = $derived(getAuth()());

	$effect(() => {
		if (open) {
			dialogToggle(true);
			resetLiquidityDraft();
			if (preselectedPool) {
				// Seed the draft with the pool so the user skips the
				// Select a pool step and lands directly on amount input.
				liquidityDraftStore.update((d) => ({ ...d, selectedPool: preselectedPool }));
			}
		}
	});

	const stepsData: MixedStepsArray = [
		{ value: 'options', component: AddLiquidityOptions },
		{ value: 'review', component: AddLiquidityReview },
		{ value: 'complete', component: AddLiquidityComplete }
	];

	async function submitAddLiquidity(setStatus: (s: string, isError?: boolean) => void) {
		if (!auth.value?.aioha || !auth.value?.username) {
			setStatus('Error: not authenticated.', true);
			return new Error('Not authenticated');
		}
		const draft = get(liquidityDraftStore);
		if (!draft.selectedPool) {
			setStatus('Please select a pool.', true);
			return new Error('No pool selected');
		}
		if (draft.hasError || draft.amount0Ca.amount === 0 || draft.amount1Ca.amount === 0) {
			setStatus('Please fix form errors before submitting.', true);
			return new Error('Invalid liquidity form');
		}

		setStatus('Waiting for Hive wallet approval…');
		const res = await addLiquidityTx(
			draft.amount0Ca,
			draft.amount1Ca,
			auth.value.username,
			auth.value.aioha,
			draft.selectedPool
		);
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
		Add Liquidity
	{/snippet}
	{#snippet content()}
		<StepsMachine
			size="dialog"
			txType="add liquidity"
			{stepsData}
			onSubmit={submitAddLiquidity}
			extraProps={{ pools, close: dialogToggle, onClose: () => dialogToggle(false) }}
		/>
	{/snippet}
</Dialog>
