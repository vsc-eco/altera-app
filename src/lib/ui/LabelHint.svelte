<script lang="ts">
	/**
	 * A field label with its (?) attached — `<label>Slippage (?)</label>`.
	 *
	 * Separate from `StatRow` because this one is a real `<label>` with a
	 * `for`, so clicking the text focuses the input. The (?) inside it stops
	 * its own click, so tapping the hint does not focus the field.
	 */
	import Hint from './Hint.svelte';

	let {
		text,
		hint,
		forId,
		size = 'label'
	}: {
		text: string;
		/** One or two sentences behind the (?). Omit for a plain label. */
		hint?: string;
		/** `id` of the input this labels. */
		forId?: string;
		/** `label` is the 13px form label; `meta` is the smaller grey one. */
		size?: 'label' | 'meta';
	} = $props();
</script>

<label class={size === 'meta' ? 'alt-meta wrap' : 'alt-label wrap'} for={forId}>
	{text}
	{#if hint}<Hint text={hint} label="About {text}" size={14} />{/if}
</label>

<style lang="scss">
	.wrap {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		min-width: 0;
		overflow-wrap: anywhere;
	}
</style>
