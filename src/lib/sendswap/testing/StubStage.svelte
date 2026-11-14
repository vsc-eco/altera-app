<script lang="ts">
	// Test-only stage for StepsMachine: a button that advances, and what the
	// machine passes down. Only the active stage gets `next`, so only it renders
	// (a popup stage keeps the one under it visible).
	let {
		next,
		status,
		waiting = false
	}: {
		next?: () => void;
		status?: { message: string; isError: boolean };
		waiting?: boolean;
	} = $props();
</script>

{#if next}
	<button onclick={() => next?.()}>go</button>
	<p data-testid="status">{status?.message ?? ''}</p>
	<p data-testid="waiting">{waiting ? 'waiting' : 'idle'}</p>
{/if}
