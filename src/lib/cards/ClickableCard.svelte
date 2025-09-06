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
		border-radius: .75rem;
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
			color: inherit;
		}
		&:not(:disabled) {
			cursor: pointer;
		}
		&.defaultBg {
			background-color: var(--neutral-bg);
		}
		box-shadow: 0 0 4px var(--dark-purple-less-opacity);
	}
</style>
