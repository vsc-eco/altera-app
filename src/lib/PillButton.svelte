<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';
	type Props = {
		onclick?: MouseEventHandler<HTMLButtonElement>;
		children?: Snippet;
		icon?: Snippet;
		href?: string;
		theme?: string;
		invert?: boolean;
	};
	let { onclick, children, icon, href, theme = 'neutral', invert }: Props = $props();
	let className = $derived([theme, { invert }]);
</script>

{#snippet inner()}
	{#if icon}
		{@render icon()}
	{/if}

	{#if children}
		{@render children()}
	{:else}
		Click me!
	{/if}
{/snippet}
{#if href}
	<a {href} class={className}>{@render inner()}</a>
{:else if onclick}
	<button {onclick} class={className}>{@render inner()}</button>
{:else}
	<button class={className}>actionless</button>
{/if}

<style lang="scss">
	button,
	a {
		--height: 32px;
		height: var(--height);
		border-radius: calc(var(--height) / 2);
		color: inherit;
		font: inherit;
		border: none;
		padding: 0.25rem 0.75rem;
		margin: 0.5rem 0.1rem;
		box-sizing: border-box;
		display: inline-flex;
		gap: 0.125rem;
		align-items: center;
		text-decoration: none;
		vertical-align: middle;
		position: relative;
		overflow: hidden;
		transition: transform 0.05s;

		background-color: var(--bg-accent);
		color: var(--fg-mid);
		&:hover {
			background-color: var(--bg-accent-shifted);
			color: var(--fg-accent);
		}
		&:active {
			background-color: var(--bg-accent-shifted);
			color: var(--fg);
			transform: scale(0.98);
		}
		:global(svg) {
			height: 18px;
		}
		&.invert {
			background-color: var(--mid);
			color: var(--bg);
			&:hover {
				background-color: var(--fg-mid);
				color: var(--bg);
			}
			&:active {
				background-color: var(--fg-mid);
				color: var(--bg);
			}
		}
	}
</style>
