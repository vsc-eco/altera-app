<script lang="ts">
	/**
	 * The accordion of questions on the right of the transfer / deposit /
	 * withdraw flows.
	 *
	 * It was twelve hand-written copies — three files × four questions —
	 * each with its own `openFaqIdx` index, its own `toggleFaq`, and the same
	 * four-element trigger/divider/body markup written out by hand. Adding a
	 * fifth question meant copying a block and remembering to renumber it.
	 *
	 * One question is open at a time, which is deliberate: these sit in a
	 * narrow rail beside a form, and four open answers push the form's own
	 * steps off the screen.
	 *
	 * An answer is a snippet, so it can hold lists, `<strong>` and links —
	 * the existing ones do.
	 */
	import type { Snippet } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';

	let {
		items,
		title = 'FAQ'
	}: {
		items: { q: string; a: Snippet }[];
		/** The heading above the list. Pass `''` for none. */
		title?: string;
	} = $props();

	let openIdx = $state<number | null>(null);
</script>

<section class="faq">
	{#if title}<h5>{title}</h5>{/if}
	{#each items as item, i (item.q)}
		{@const open = openIdx === i}
		<Card>
			<button
				class="faq-trigger"
				class:open
				type="button"
				aria-expanded={open}
				onclick={() => (openIdx = open ? null : i)}
			>
				<span>{item.q}</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if open}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">{@render item.a()}</div>
			{/if}
		</Card>
	{/each}
</section>

<style lang="scss">
	.faq {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
	}
	h5 {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--alt-mut, var(--dash-text-muted));
	}

	/* `:global` because the trigger and body live inside `Card`'s slot, and
	   the body's contents come from the caller's snippet. */
	:global(.faq-trigger) {
		box-sizing: border-box;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		/* Pull out to the card's edge so the whole card is the hit target. */
		margin: -1.25rem;
		padding: 1.25rem;
		background: transparent;
		border: none;
		color: var(--alt-tx, var(--dash-text-primary));
		font: inherit;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		border-radius: 27px;
	}
	:global(.faq-trigger.open) {
		margin-bottom: 0;
	}
	:global(.faq-chevron) {
		flex-shrink: 0;
		transition: transform 200ms ease;
		color: var(--alt-tx-2, var(--dash-text-secondary));
	}
	:global(.faq-trigger.open .faq-chevron) {
		transform: rotate(180deg);
	}
	:global(.faq-divider) {
		padding: 0.5rem 0;
	}
	:global(.faq-divider hr) {
		margin: 0;
		border: none;
		border-top: 1px solid var(--alt-card-border, rgba(255, 255, 255, 0.08));
	}
	:global(.faq-body) {
		font-size: 0.83rem;
		line-height: 1.5;
		color: var(--alt-tx-2, var(--dash-text-secondary));
		font-weight: 400;
		overflow-wrap: anywhere;
	}
	:global(.faq-body p) {
		margin: 0 0 0.5rem;
	}
	:global(.faq-body p:last-child) {
		margin-bottom: 0;
	}
	:global(.faq-body ul),
	:global(.faq-body ol) {
		margin: 0.25rem 0 0.5rem;
		padding-left: 1.1rem;
	}
	:global(.faq-body li) {
		margin: 0.25rem 0;
	}
	:global(.faq-body li::marker) {
		color: var(--alt-mut, var(--dash-text-muted));
	}
	:global(.faq-body strong) {
		color: var(--alt-tx, var(--dash-text-primary));
		font-weight: 600;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.faq-chevron) {
			transition: none;
		}
	}
</style>
