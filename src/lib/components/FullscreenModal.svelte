<script lang="ts">
	import { type Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	let {
		children
	}: {
		children: Snippet;
	} = $props();
</script>

<div transition:fly={{ y: 600, duration: 300 }}>
	{@render children()}
</div>

<style>
	div {
		position: absolute;
		top: 0;
		left: 0;
		width: calc(100vw - 1rem);
		height: 100dvh;
		background-color: var(--neutral-bg);
		z-index: 500;
		padding: 0 0.5rem;
	}
</style>
