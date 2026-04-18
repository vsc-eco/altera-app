<script lang="ts">
	import PieTimer from '$lib/components/PieTimer.svelte';
	import PillButton from '$lib/PillButton.svelte';

	let timer = $state<PieTimer>();
	let {
		enabled = true,
		onClose = () => {}
	}: {
		enabled?: boolean;
		onClose?: () => void;
	} = $props();

	let timerStarted = false;
	let timerCanceled = $state(false);
	function cancelTimer() {
		timer?.stop();
		timerCanceled = true;
	}
	$effect(() => {
		if (enabled && !timerStarted) {
			timer?.start();
			timerStarted = true;
		}
		if (!enabled && timerStarted) {
			timer?.stop();
			timerStarted = false;
			timerCanceled = false;
		}
	});
</script>

{#if enabled && !timerCanceled}
	<div class="redirect">
		<p>Closing…</p>
		<PieTimer bind:this={timer} onComplete={() => onClose()} />
		<PillButton onclick={cancelTimer}>Stay</PillButton>
	</div>
{/if}

<style>
	.redirect {
		margin-top: 2rem;
		display: flex;
		gap: 1rem;
		align-items: center;
	}
</style>

