<script lang="ts">
	/**
	 * A tinted box that tells the reader something before they act.
	 *
	 * The app had at least four of these — the internal-transfer warning, the
	 * BTC vault-rotation notice, the deprecated-pool banner, the swap safety
	 * messages — each with its own colours and none with an icon that matched
	 * its severity. Same shape, one place.
	 *
	 * Keep the body to a sentence. Anything longer goes behind `hint`: the
	 * point of the redesign is that a screen is readable without a paragraph
	 * on it, and a warning nobody finishes reading warns nobody.
	 */
	import type { Snippet } from 'svelte';
	import { Info, TriangleAlert, OctagonAlert, CircleCheck } from '@lucide/svelte';
	import Hint from './Hint.svelte';

	let {
		tone = 'info',
		title,
		hint,
		hintContent,
		actions,
		children
	}: {
		tone?: 'info' | 'warn' | 'error' | 'success';
		/** Bold first line. With no `children` this is the whole notice. */
		title?: string;
		/** The long version, behind a (?). */
		hint?: string;
		/** Richer hint content; wins over `hint`. */
		hintContent?: Snippet;
		/** A button or link on the right. */
		actions?: Snippet;
		/** The sentence. */
		children?: Snippet;
	} = $props();

	const Icon = $derived(
		{ info: Info, warn: TriangleAlert, error: OctagonAlert, success: CircleCheck }[tone]
	);
	const role = $derived(tone === 'error' ? 'alert' : 'status');
</script>

<div class="notice {tone}" {role}>
	<span class="icon" aria-hidden="true"><Icon size={16} /></span>
	<div class="text">
		{#if title}
			<span class="title">
				{title}
				{#if hintContent}
					<Hint size={14}>{@render hintContent()}</Hint>
				{:else if hint}
					<Hint text={hint} size={14} />
				{/if}
			</span>
		{/if}
		{#if children}
			<span class="body">
				{@render children()}
				{#if !title && hintContent}
					<Hint size={14}>{@render hintContent()}</Hint>
				{:else if !title && hint}
					<Hint text={hint} size={14} />
				{/if}
			</span>
		{/if}
	</div>
	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
</div>

<style lang="scss">
	.notice {
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		gap: 9px;
		min-width: 0;
		padding: 10px 12px;
		border-radius: 14px;
		border: 1px solid transparent;
		font-size: 13px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	.icon {
		display: flex;
		flex: none;
		margin-top: 1px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1 1 auto;
	}
	.title {
		font-weight: 800;
	}
	.body {
		color: inherit;
		opacity: 0.92;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	.info {
		background: var(--alt-acc-soft, rgba(111, 106, 248, 0.15));
		border-color: var(--alt-acc-soft-hover, rgba(111, 106, 248, 0.25));
		color: var(--alt-acc-tx, #a9a5ff);
	}
	.warn {
		background: rgba(251, 191, 36, 0.12);
		border-color: rgba(251, 191, 36, 0.3);
		color: #fbbf24;
	}
	.error {
		background: rgba(255, 107, 107, 0.12);
		border-color: rgba(255, 107, 107, 0.32);
		color: var(--alt-red, #ff6b6b);
	}
	.success {
		background: var(--alt-green-soft, rgba(74, 222, 128, 0.12));
		border-color: rgba(74, 222, 128, 0.3);
		color: var(--alt-green, #4ade80);
	}

	@media (max-width: 480px) {
		.notice {
			flex-wrap: wrap;
		}
		.actions {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
