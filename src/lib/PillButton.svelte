<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		HTMLAnchorAttributes,
		HTMLButtonAttributes,
		MouseEventHandler
	} from 'svelte/elements';
	export type SharedProps = {
		children?: Snippet;
		theme?: string;
		style?: 'invert' | 'text' | 'outline' | 'default' | 'icon';
	};
	export type AnchorProps = { href: string; onclick?: undefined } & HTMLAnchorAttributes;
	export type ButtonAttributes = {
		href?: undefined;
		onclick: MouseEventHandler<HTMLButtonElement>;
	} & HTMLButtonAttributes;
	export type Props = SharedProps & (AnchorProps | ButtonAttributes);
	let { children, theme = 'neutral', style, ...rest }: Props = $props();
	let invertStyle = $derived(style == 'invert');
	let textStyle = $derived(style == 'text');
	let outlineStyle = $derived(style == 'outline');
	let iconStyle = $derived(style == 'icon');
	let className = $derived([
		theme,
		{ invert: invertStyle, text: textStyle, outline: outlineStyle, icon: iconStyle }
	]);
</script>

{#snippet inner()}
	{#if children}
		{@render children()}
	{:else}
		Click me!
	{/if}
{/snippet}
{#if rest.href}
	<a class={className} {...rest}>{@render inner()}</a>
{:else if rest.onclick}
	<button class={className} {...rest}>{@render inner()}</button>
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
		white-space: nowrap; /* keep on same line */
		transition: transform 0.05s;

		background-color: var(--bg-accent);
		color: var(--fg-accent-shifted);
		&:hover {
			background-color: var(--bg-accent-shifted);
			color: var(--fg-accent);
		}
		&:active {
			background-color: var(--bg-accent-shifted);
			color: var(--fg);
			transform: scale(0.98);
		}
		:global(.lucide-check) {
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
		&.text {
			background-color: transparent;
			color: var(--fg);
			&:hover {
				background-color: var(--bg-accent);
				color: var(--fg);
			}
			&:active {
				background-color: var(--bg-accent);
				color: var(--fg);
			}
		}
		&.outline {
			background-color: transparent;
			color: var(--fg);
			border: 1px solid var(--bg-mid);
			&:hover {
				background-color: var(--bg-accent);
				color: var(--fg);
			}
			&:active {
				background-color: var(--bg-accent);
				color: var(--fg);
			}
		}
		&.icon {
			padding: 0.5rem;
			width: 2rem;
			height: 2rem;
			box-sizing: border-box;
		}
		&.icon:hover {
			color: var(--primary-fg-mid);
		}
	}
</style>
