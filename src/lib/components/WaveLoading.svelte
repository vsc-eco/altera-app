<script lang="ts">
	import { Dot } from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface Props {
		size?: number;
		color?: string;
		duration?: number;
	}

	let { size = 24, color = 'currentColor', duration = 1.4 }: Props = $props();

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});

	const width = $derived((size * 3) / 4);
</script>

<div class="wave-loader" style="--duration: {duration}s; --width: {width}px;">
	{#each Array(3) as _, i}
		<span class="dot dot-{i + 1}">
			<Dot {size} {color} style="animation-delay: {i * 0.16}s" />
		</span>
	{/each}
</div>

<style>
	.wave-loader {
		display: inline-flex;
		align-items: center;
		gap: var(--gap); /* Overlap dots slightly */
	}

	.dot {
		width: var(--width);
		animation: wave var(--duration) ease-in-out infinite;
		display: flex;
		justify-content: center;
	}

	@keyframes wave {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		30% {
			transform: translateY(-10px);
			opacity: 1;
		}
	}

	/* Optional: Add a subtle scale effect */
	.dot:global(.dot-1) {
		animation-delay: 0s;
	}

	.dot:global(.dot-2) {
		animation-delay: 0.16s;
	}

	.dot:global(.dot-3) {
		animation-delay: 0.32s;
	}
</style>
