<script lang="ts">
	import type { HTMLStyleAttributes } from 'svelte/elements';

	let { text, style }: { text: string; style?: string } = $props();
</script>

<div class="divider" {style}>
	<hr />
	<span class="sm-caption">{text}</span>
	<hr />
</div>

<style>
	div {
		display: flex;
		align-items: center;
		gap: 1rem;
		white-space: nowrap;
	}
	hr {
		width: 100%;
		border-color: var(--neutral-bg-accent-shifted);
	}
</style>
