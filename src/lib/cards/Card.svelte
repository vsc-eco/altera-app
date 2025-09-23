<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		defaultBg?: boolean;
	};
	let { children, defaultBg = false }: Props = $props();
</script>

<div class={[{ defaultBg }, 'card']}>
	{@render children()}
</div>

<style>
	div {
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.75rem;
		padding: 0.5rem;
		overflow: auto;
		max-height: 100%;
		flex: 1 1 auto;
		box-shadow: 0 0 4px oklch(from var(--dark-purple) l c h / 0.1);
	}
	div.defaultBg {
		background-color: var(--neutral-bg);
	}
</style>
