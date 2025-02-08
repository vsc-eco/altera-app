<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';
	type Props = {
		onclick?: MouseEventHandler<HTMLButtonElement>;
		children?: Snippet;
		icon?: Snippet;
		href?: string;
		theme?: string;
	};
	let { onclick, children, icon, href, theme = 'neutral' }: Props = $props();
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
	<a {href} class={theme}>{@render inner()}</a>
{:else if onclick}
	<button {onclick} class={theme}>{@render inner()}</button>
{:else}
	<button class={theme}>actionless</button>
{/if}

<style lang="scss">
	button,
	a {
		--height: 32px;
		height: var(--height);
		border-radius: calc(var(--height) / 2);
		background-color: var(--bg-accent);
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
		&:hover {
			background-color: var(--bg-accent-shifted);
		}
		&:active {
			background-color: var(--bg-mid);
		}
		:global(svg) {
			height: 18px;
		}
	}
</style>
