<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		HTMLAnchorAttributes,
		HTMLButtonAttributes,
		MouseEventHandler
	} from 'svelte/elements';
	export type StyleFlag = 'invert' | 'outline' | 'text' | 'icon' | 'subtle' | 'submit';
	export type SharedProps = {
		children?: Snippet;
		theme?: string;
		hide?: boolean;
		styleType?: StyleFlag | (string & {});
	};
	export type AnchorProps = { href: string; onclick?: undefined } & HTMLAnchorAttributes;
	export type ButtonAttributes = {
		href?: undefined;
		onclick: MouseEventHandler<HTMLButtonElement>;
	} & HTMLButtonAttributes;
	export type Props = SharedProps & (AnchorProps | ButtonAttributes);
	let {
		children,
		theme = 'neutral',
		hide = false,
		styleType: styleType,
		class: additionalClasses = '',
		...rest
	}: Props = $props();
	let invertStyle = $derived(styleType?.includes('invert'));
	let textStyle = $derived(styleType?.includes('text'));
	let outlineStyle = $derived(styleType?.includes('outline'));
	let iconStyle = $derived(styleType?.includes('icon'));
	let subtleStyle = $derived(styleType?.includes('subtle'));
	let submitStyle = $derived(styleType?.includes('submit'));
	let className = $derived([
		theme,
		{
			invert: invertStyle,
			text: textStyle,
			outline: outlineStyle,
			icon: iconStyle,
			subtle: subtleStyle,
			submit: submitStyle,
			hide: hide
		},
		additionalClasses
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
		&.hide {
			visibility: hidden;
		}
		display: inline-flex;
		justify-content: center;
		cursor: pointer;
		--height: 2.5rem;
		box-sizing: border-box;
		height: var(--height);
		border-radius: 1.5rem;
		color: inherit;
		font-family: 'Nunito Sans', sans-serif;
		font: inherit;
		border: none;
		padding: 0.25rem 0.75rem;
		margin: 0.1rem 0.1rem;
		box-sizing: border-box;
		display: inline-flex;
		gap: 0.125rem;
		align-items: center;
		text-decoration: none;
		vertical-align: middle;
		position: relative;
		white-space: nowrap;
		transition:
			transform 0.05s,
			box-shadow 0.15s ease,
			background 0.15s ease;
		background-color: rgba(255, 255, 255, 0.1);
		color: var(--dash-text-primary);
		&:hover {
			background-color: rgba(255, 255, 255, 0.15);
			color: var(--dash-text-primary);
		}
		&:active {
			background-color: rgba(255, 255, 255, 0.15);
			color: var(--dash-text-primary);
			transform: scale(0.98);
		}
		:global(.lucide-check) {
			height: 18px;
		}
		&.invert {
			background: linear-gradient(135deg, #7b74ff 0%, #6f6af8 40%, #5b54e0 100%);
			box-shadow: 0 4px 20px rgba(111, 106, 248, 0.3);
			color: white;
			&:hover {
				background: linear-gradient(135deg, #8e88ff 0%, #7e78ff 40%, #6b64f0 100%);
				box-shadow: 0 6px 24px rgba(111, 106, 248, 0.4);
				color: white;
			}
			&:active {
				background: linear-gradient(135deg, #6f6af8 0%, #6560e8 40%, #5248d0 100%);
				box-shadow: 0 2px 12px rgba(111, 106, 248, 0.25);
				color: white;
			}
		}
		&.outline {
			background-color: transparent;
			color: var(--dash-text-primary);
			border: 1px solid rgba(111, 106, 248, 0.4);
			&:hover {
				background-color: rgba(111, 106, 248, 0.1);
				border-color: #6f6af8;
				color: var(--dash-text-primary);
				box-shadow: 0 0 16px -4px rgba(111, 106, 248, 0.2);
			}
			&:active {
				background-color: rgba(111, 106, 248, 0.15);
				color: var(--dash-text-primary);
			}
			&.primary {
				border-color: #6f6af8;
				color: var(--dash-text-primary);
				&:hover {
					background-color: rgba(111, 106, 248, 0.1);
					color: var(--dash-text-primary);
				}
				&:active {
					background-color: rgba(111, 106, 248, 0.15);
					color: var(--dash-text-primary);
				}
			}
			&.primary {
				border-color: var(--primary-mid);
				color: var(--primary-text);
				&:hover {
					background-color: var(--primary-bg-accent);
					color: var(--primary-text);
				}
				&:active {
					background-color: var(--primary-bg-accent-shifted);
					color: var(--primary-text);
				}
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
				color: #6f6af8;
				border-color: #6f6af8;
			}
		}
		&.text {
			background-color: transparent;
			color: var(--dash-text-secondary);
			border: none;
			&.neutral {
				&:hover {
					text-decoration: none;
				}
				color: var(--dash-text-primary);
			}
			&:hover {
				text-decoration: underline;
				background-color: rgba(255, 255, 255, 0.06);
				color: var(--dash-text-primary);
			}
			&:active {
				background-color: rgba(255, 255, 255, 0.06);
				color: var(--dash-text-primary);
			}
		}
		&.submit {
			height: 48px;
			width: calc(100% - 0.2rem);
			font-size: 0.95rem;
			font-weight: 700;
			&:hover {
				transform: scale(0.98);
			}
		}
		&.subtle {
			background-color: transparent;
			color: var(--dash-text-secondary);
			padding: 0;
			height: min-content;
			width: min-content;
			&:hover {
				color: var(--dash-text-primary);
				background-color: transparent;
			}
			&:active {
				background-color: transparent;
			}
		}
		&:disabled {
			cursor: default;
			color: var(--dash-text-muted);
			transform: scale(0.98);
			background: rgba(255, 255, 255, 0.05);
			box-shadow: none;
			&:active,
			&:hover,
			&:focus {
				color: var(--dash-text-muted);
				background: rgba(255, 255, 255, 0.05);
				box-shadow: none;
				transform: scale(0.98);
			}
		}
	}
</style>
