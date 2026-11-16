<script lang="ts">
	/**
	 * "There is nothing here (yet)."
	 *
	 * An empty state has to say three things: that the list really is empty,
	 * why it might be, and what to do about it. The ones in the app said only
	 * the first — and after the abort-race bug, "No transfers yet" over a full
	 * account was indistinguishable from a working empty list. So this takes
	 * an `action` and a `hint`, and the pages that can be wrong about it say
	 * so in the hint.
	 */
	import type { Snippet } from 'svelte';
	import Hint from './Hint.svelte';

	let {
		title,
		description,
		hint,
		icon,
		action
	}: {
		/** "No transactions yet". Short. */
		title: string;
		/** One line under it. Optional — prefer `hint` for anything longer. */
		description?: string;
		/** The explanation, behind a (?). */
		hint?: string;
		/** A lucide icon, already sized by the caller. */
		icon?: Snippet;
		/** The way out — usually one Button. */
		action?: Snippet;
	} = $props();
</script>

<div class="empty">
	{#if icon}
		<span class="icon" aria-hidden="true">{@render icon()}</span>
	{/if}
	<p class="title">
		{title}
		{#if hint}<Hint text={hint} size={15} />{/if}
	</p>
	{#if description}
		<p class="desc">{description}</p>
	{/if}
	{#if action}
		<div class="action">{@render action()}</div>
	{/if}
</div>

<style lang="scss">
	.empty {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		padding: 28px 16px;
		text-align: center;
		color: var(--alt-tx-2, #9ca3af);
	}
	.icon {
		display: flex;
		margin-bottom: 2px;
		color: var(--alt-mut, #6b7280);
	}
	.title {
		display: inline-flex;
		align-items: center;
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		color: var(--alt-tx, #fff);
	}
	.desc {
		margin: 0;
		max-width: 44ch;
		font-size: 13px;
		line-height: 1.5;
	}
	.action {
		margin-top: 10px;
	}
	@media (max-width: 480px) {
		.empty {
			padding: 22px 12px;
		}
	}
</style>
