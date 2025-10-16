<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';

	type Props = {
		onclick: MouseEventHandler<HTMLButtonElement>;
		disabled?: boolean;
		children: Snippet;
		defaultBg?: boolean;
	};
	let { onclick, disabled = false, children, defaultBg = false }: Props = $props();

	const disabledActually = !!disabled;
</script>

<button disabled={disabledActually} {onclick} class={{ defaultBg }}>
	{@render children()}
</button>

<style lang="scss">
	button {
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.75rem;
		padding: 0.5rem;
		overflow: auto;
		max-height: 100%;
		width: 100%;
		color: inherit;
		font: inherit;
		&:disabled {
			pointer-events: none;
			opacity: 1;
			background-color: var(--neutral-off-bg);
			filter: grayscale(1);
			color: var(--neutral-mid);
		}
		&:not(:disabled) {
			cursor: pointer;
		}
		&.defaultBg {
			background-color: var(--neutral-bg);
		}
		box-shadow: 0 0 4px oklch(from var(--dark-purple) l c h / 0.1);
	}
</style>
