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
		background-color: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1.25rem;
		overflow: auto;
		max-height: 100%;
		flex: 1 1 auto;
	}
	div.defaultBg {
		background-color: var(--dash-bg);
	}
</style>
