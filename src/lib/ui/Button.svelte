<script lang="ts">
	/**
	 * One button. The redesign has exactly four looks, and they already live
	 * as global classes in `styles/redesign.scss` — this component picks one
	 * and, crucially, renders an `<a>` when it is given an `href`.
	 *
	 * That last part is the reason it exists: the codebase was full of
	 * `<button onclick={() => goto('…')}>`, which cannot be middle-clicked,
	 * opened in a new tab, or read as a link by a screen reader.
	 *
	 * Variants:
	 *   `primary`   the one commit action on a screen (full width, 56px)
	 *   `secondary` an outlined alternative
	 *   `soft`      a small accent pill ("Max", "Connect")
	 *   `ghost`     text only, for a tertiary action
	 */
	import type { Snippet } from 'svelte';
	import Spinner from './Spinner.svelte';

	let {
		variant = 'secondary',
		href,
		type = 'button',
		disabled = false,
		loading = false,
		full = false,
		title,
		ariaLabel,
		target,
		rel,
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'soft' | 'ghost';
		/** Renders an `<a>` instead of a `<button>`. */
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		/** Swaps the label for a spinner and blocks the click. */
		loading?: boolean;
		/** Stretch to the container's width (primary already does). */
		full?: boolean;
		title?: string;
		ariaLabel?: string;
		target?: string;
		rel?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();

	const cls = $derived([
		'alt-ui-btn',
		`alt-btn-${variant}`,
		full ? 'full' : '',
		loading ? 'loading' : ''
	]
		.filter(Boolean)
		.join(' '));

	const blocked = $derived(disabled || loading);
</script>

{#if href && !blocked}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from the caller; resolve() is not exported in this kit version -->
	<a class={cls} {href} {title} {target} {rel} aria-label={ariaLabel} {onclick}>
		{@render children()}
	</a>
{:else}
	<button
		class={cls}
		{type}
		{title}
		aria-label={ariaLabel}
		aria-busy={loading}
		disabled={blocked}
		onclick={(e) => {
			if (blocked) return;
			onclick?.(e);
		}}
	>
		{#if loading}
			<Spinner size={18} inline label="Working" />
		{:else}
			{@render children()}
		{/if}
	</button>
{/if}

<style lang="scss">
	/* The look comes from the global .alt-btn-* classes; this only adds the
	   things every variant needs and that an `<a>` does not get for free. */
	.alt-ui-btn {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		text-decoration: none;
		text-align: center;
	}
	.alt-ui-btn.full {
		width: 100%;
	}
	/* `.alt-btn-secondary` and `.alt-btn-soft` have no disabled rule of their
	   own — without this a dead button looks live. */
	.alt-ui-btn:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
	.alt-ui-btn.loading {
		cursor: progress;
	}

	.alt-btn-ghost {
		border: 0;
		background: none;
		padding: 6px 10px;
		border-radius: 12px;
		font: inherit;
		font-size: 14px;
		font-weight: 700;
		color: var(--alt-acc-tx, #a9a5ff);
		cursor: pointer;
	}
	.alt-btn-ghost:hover:not(:disabled) {
		background: var(--alt-chip, rgba(255, 255, 255, 0.07));
	}

	/* 390px: a secondary button sitting next to a primary one has to be able
	   to drop to its own line rather than squeeze the label to two letters. */
	@media (max-width: 420px) {
		.alt-ui-btn {
			min-width: 0;
		}
	}
</style>
