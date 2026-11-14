<script lang="ts">
	// Test-only wrapper: StepsMachine reads its tx state from context.
	import { provideTxState, type TxState } from '$lib/sendswap/utils/txState.svelte';
	import StepsMachine from '$lib/sendswap/StepsMachine.svelte';
	import StubStage from './StubStage.svelte';

	let {
		txState,
		onSubmit
	}: {
		txState: TxState;
		onSubmit?: (
			setStatus: (s: string, isError?: boolean) => void,
			signal: AbortSignal
		) => Promise<Error | { id: string }>;
	} = $props();
	// svelte-ignore state_referenced_locally
	provideTxState(txState);
	const stepsData = [
		{ value: 'options', component: StubStage },
		{ value: 'review', component: StubStage, popup: true },
		{ value: 'complete', component: StubStage, popup: true }
	];
</script>

<StepsMachine size="page" txType="swap" {stepsData} {onSubmit} />
