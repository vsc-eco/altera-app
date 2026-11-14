<script lang="ts">
	// Test-only wrapper: ReviewSwap reads its tx state from context. It mounts
	// inactive and becomes active after mount, as it does in StepsMachine.
	import { onMount } from 'svelte';
	import { provideTxState, type TxState } from '$lib/sendswap/utils/txState.svelte';
	import ReviewSwap from '$lib/sendswap/stages/ReviewSwap.svelte';

	let { txState, next, goHome }: { txState: TxState; next: () => void; goHome: () => void } =
		$props();
	// svelte-ignore state_referenced_locally
	provideTxState(txState);
	let active = $state(false);
	onMount(() => {
		active = true;
	});
</script>

<ReviewSwap popup isActive={active} status={{ message: '', isError: false }} {next} {goHome} />
