<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';

	type Props = {
		onclick: MouseEventHandler<HTMLButtonElement>;
		disabled?: boolean;
		children: Snippet;
		defaultBg?: boolean;
		tabindex?: number;
		onkeydown?: (e: KeyboardEvent) => void;
	};
	let {
		onclick,
		disabled = false,
		children,
		defaultBg = false,
		tabindex,
		onkeydown
	}: Props = $props();
</script>

<button {disabled} {onclick} {tabindex} {onkeydown} class={{ defaultBg }}>
	{@render children()}
</button>

<style lang="scss">
	button {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		padding: 0.75rem;
		overflow: auto;
		max-height: 100%;
		width: 100%;
		color: var(--dash-text-primary);
		font: inherit;
		&:disabled {
			pointer-events: none;
			opacity: 0.5;
			filter: grayscale(1);
			color: var(--dash-text-muted);
		}
		&:not(:disabled) {
			cursor: pointer;
		}
		&.defaultBg {
			background: var(--dash-card-bg);
		}
		box-shadow: var(--dash-card-shadow);
	}
</style>
