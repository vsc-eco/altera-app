<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
	};
	let { children }: Props = $props();
</script>

<div>
	{@render children()}
</div>

<style>
	div {
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.5rem;
		padding: 0.5rem;
		overflow: auto;
		max-height: 100%;
	}
</style>
