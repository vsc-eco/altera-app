<script lang="ts">
	/**
	 * A panel with an optional title row.
	 *
	 * Nearly every redesigned page had its own copy of "div.alt-card, inside
	 * it a header row with an h2 on the left and some buttons on the right,
	 * then the content" — with a different gap and a different title size
	 * each time. This is that shape, once.
	 *
	 * `hint` puts a (?) after the title instead of a paragraph under it.
	 * `actions` is the right-hand side of the title row.
	 */
	import type { Snippet } from 'svelte';
	import Hint from './Hint.svelte';

	let {
		title,
		hint,
		hintContent,
		actions,
		padded = true,
		as = 'section',
		titleAs = 'h2',
		children
	}: {
		/** Left side of the title row. Omit for a bare panel. */
		title?: string;
		/** One or two sentences behind a (?) next to the title. */
		hint?: string;
		/** Richer hint content; wins over `hint`. */
		hintContent?: Snippet;
		/** Right side of the title row — buttons, a range picker, a count. */
		actions?: Snippet;
		/** `false` strips the inner padding, for a card that holds a table. */
		padded?: boolean;
		/** Element to render. `div` when the card is not a landmark. */
		as?: 'section' | 'div' | 'article';
		/** Heading level of the title, so a page keeps one h1 and sane order. */
		titleAs?: 'h1' | 'h2' | 'h3';
		children: Snippet;
	} = $props();
</script>

{#snippet inner()}
	{#if title || actions}
		<header class="head">
			{#if title}
				<div class="title-wrap">
					<svelte:element this={titleAs} class="title">{title}</svelte:element>
					{#if hintContent}
						<Hint>{@render hintContent()}</Hint>
					{:else if hint}
						<Hint text={hint} />
					{/if}
				</div>
			{/if}
			{#if actions}
				<div class="actions">{@render actions()}</div>
			{/if}
		</header>
	{/if}
	<div class="body" class:padded>
		{@render children()}
	</div>
{/snippet}

<svelte:element this={as} class="alt-card ui-card">
	{@render inner()}
</svelte:element>

<style lang="scss">
	.ui-card {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		/* `.alt-card`'s own 8px padding is for the swap card, where the inner
		   field panels carry the real inset. A content card needs more. */
		padding: 16px;
		gap: 12px;
		min-width: 0;
	}
	.head {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		min-width: 0;
	}
	.title-wrap {
		display: flex;
		align-items: center;
		min-width: 0;
	}
	.title {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		color: var(--alt-tx, #fff);
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.body {
		min-width: 0;
	}
	.body.padded {
		/* Nothing: the card's own padding is the inset. The class exists so
		   `padded={false}` can pull a full-bleed table out to the edges. */
	}
	.body:not(.padded) {
		margin: 0 -16px -16px;
	}

	@media (max-width: 480px) {
		.ui-card {
			padding: 14px;
			border-radius: 22px;
		}
		.body:not(.padded) {
			margin: 0 -14px -14px;
		}
		.actions {
			/* On a phone the actions belong under the title, full width,
			   not squeezed into the same 390px row. */
			width: 100%;
		}
	}
</style>
