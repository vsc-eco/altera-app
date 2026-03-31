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
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1.25rem;
		overflow: auto;
		max-height: 100%;
		flex: 1 1 auto;
	}
	div.defaultBg {
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%),
			linear-gradient(160deg, rgba(111, 106, 248, 0.15) 0%, rgba(60, 50, 140, 0.08) 50%, transparent 100%);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		will-change: transform;
	}
	:global(.light-theme) div.defaultBg {
		background: #FFFFFF;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
</style>
