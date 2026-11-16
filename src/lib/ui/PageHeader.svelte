<script lang="ts">
	/**
	 * The `<h1>` at the top of a page, plus the one line under it and
	 * whatever sits on the right (a filter, a "New…" button, a count).
	 *
	 * The redesigned pages each wrote their own 26px bold h1 with a different
	 * margin, and several of them followed it with a paragraph of explanation
	 * nobody reads. The paragraph belongs in `hint`.
	 */
	import type { Snippet } from 'svelte';
	import Hint from './Hint.svelte';

	let {
		title,
		subtitle,
		hint,
		hintContent,
		actions,
		titleAs = 'h1',
		spacing = 'tight'
	}: {
		title: string;
		/** At most one short line. */
		subtitle?: string;
		/** What the page is for, behind a (?). */
		hint?: string;
		/** Richer hint content; wins over `hint`. */
		hintContent?: Snippet;
		actions?: Snippet;
		/** Heading level, so a page keeps one h1 and a sane outline. A page
		 *  inside the wallet chrome already has one above it. */
		titleAs?: 'h1' | 'h2' | 'h3';
		/** `page` leaves the 2rem gap a standalone page heading wants before
		 *  its first section; `tight` sits just above its own content. */
		spacing?: 'tight' | 'page';
	} = $props();
</script>

<header class="page-header {spacing}">
	<div class="left">
		<svelte:element this={titleAs} class="title">
			{title}
			{#if hintContent}
				<Hint size={18}>{@render hintContent()}</Hint>
			{:else if hint}
				<Hint text={hint} size={18} />
			{/if}
		</svelte:element>
		{#if subtitle}
			<p class="subtitle">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
</header>

<style lang="scss">
	.page-header {
		box-sizing: border-box;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		min-width: 0;
		margin-bottom: 4px;
	}
	.page-header.page {
		margin-bottom: 2rem;
	}
	.left {
		min-width: 0;
	}
	.title {
		display: flex;
		align-items: center;
		margin: 0;
		font-size: 26px;
		font-weight: 700;
		line-height: 1.2;
		color: var(--alt-tx, #fff);
		overflow-wrap: anywhere;
	}
	.subtitle {
		margin: 4px 0 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--alt-tx-2, #9ca3af);
		max-width: 60ch;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	@media (max-width: 480px) {
		.title {
			font-size: 22px;
		}
		.actions {
			width: 100%;
		}
	}
</style>
