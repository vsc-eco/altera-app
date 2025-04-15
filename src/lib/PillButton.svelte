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
		styleType?: 'invert' | 'text' | 'outline' | 'default' | 'icon' | 'icon-outline' | 'icon-text';
	};
	export type AnchorProps = { href: string; onclick?: undefined } & HTMLAnchorAttributes;
	export type ButtonAttributes = {
		href?: undefined;
		onclick: MouseEventHandler<HTMLButtonElement>;
	} & HTMLButtonAttributes;
	export type Props = SharedProps & (AnchorProps | ButtonAttributes);
	let { children, theme = 'neutral', styleType: type, ...rest }: Props = $props();
	let invertStyle = $derived(type == 'invert');
	let textStyle = $derived(type == 'text' || type == 'icon-text');
	let outlineStyle = $derived(type == 'outline' || type == 'icon-outline');
	let iconStyle = $derived(type == 'icon' || type == 'icon-outline' || type == 'icon-text');
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
		display: inline-flex;
		justify-content: center;
		cursor: pointer;
		--height: 2.5rem;
		box-sizing: border-box;
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
		&:disabled {
			cursor: default;
			color: var(--fg-mid) !important;
			transform: scale(0.98) !important;
			background-color: var(--bg-accent) !important;
			&:active,
			&:hover,
			&:focus {
				color: var(--fg-mid) !important;
				background-color: var(--bg-accent) !important;
				transform: scale(0.98) !important;
			}
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
			background-color: var(--fg-mid);
			color: var(--bg);
			&:hover {
				color: var(--bg);
			}
			&:active {
				color: var(--bg);
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
			padding: 0.125rem;
			aspect-ratio: 1;
			width: 2.5rem;
			height: 2.5rem;
			box-sizing: border-box;
			display: flex;
			justify-content: center;
			align-items: center;
			&:hover {
				color: var(--primary-fg-mid);
				border-color: var(--primary-mid);
			}
		}
		&.text {
			background-color: transparent;
			color: var(--fg);
			border: none;
			&:hover {
				background-color: var(--bg-accent);
				color: var(--fg);
			}
			&:active {
				background-color: var(--bg-accent);
				color: var(--fg);
			}
		}
	}
</style>
