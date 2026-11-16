<script lang="ts">
	/**
	 * `label ·························· value`
	 *
	 * The quote summary, the pool detail stats, the review screen and the
	 * staking card all draw this row, and all four drew it differently. One
	 * of them is the swap summary, where "Rate / Fee / Min received / Price
	 * impact" is the whole point of the screen — so the row takes a (?)
	 * rather than needing a paragraph underneath explaining the four terms.
	 *
	 * `tone` tints the value: `good` for a saving, `warn` for something the
	 * reader should look at, `bad` for a loss.
	 */
	import type { Snippet } from 'svelte';
	import Hint from './Hint.svelte';

	let {
		label,
		value,
		hint,
		tone = 'plain',
		strong = false,
		children
	}: {
		label: string;
		/** The right-hand side as text. Use `children` for markup. */
		value?: string;
		/** One or two sentences behind a (?) after the label. */
		hint?: string;
		tone?: 'plain' | 'good' | 'warn' | 'bad' | 'muted';
		/** Emphasise the row — the total, the amount actually received. */
		strong?: boolean;
		/** Markup on the right instead of `value`. */
		children?: Snippet;
	} = $props();
</script>

<div class="row" class:strong>
	<span class="label">
		{label}
		{#if hint}<Hint text={hint} label="About {label}" size={14} />{/if}
	</span>
	<span class="value {tone}">
		{#if children}{@render children()}{:else}{value}{/if}
	</span>
</div>

<style lang="scss">
	.row {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-width: 0;
		font-size: 13px;
		line-height: 1.5;
		padding: 3px 0;
	}
	.label {
		display: inline-flex;
		align-items: center;
		flex: 0 1 auto;
		min-width: 0;
		color: var(--alt-tx-2, #9ca3af);
		font-weight: 600;
	}
	.value {
		flex: 1 1 auto;
		min-width: 0;
		text-align: right;
		color: var(--alt-tx, #fff);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		/* A long amount must wrap rather than push the row past 390px. */
		overflow-wrap: anywhere;
	}
	.row.strong .label,
	.row.strong .value {
		font-size: 14px;
		font-weight: 800;
	}
	.row.strong .label {
		color: var(--alt-tx, #fff);
	}
	.value.good {
		color: var(--alt-green, #4ade80);
	}
	.value.warn {
		color: #fbbf24;
	}
	.value.bad {
		color: var(--alt-red, #ff6b6b);
	}
	.value.muted {
		color: var(--alt-mut, #6b7280);
	}
</style>
