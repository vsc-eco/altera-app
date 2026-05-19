<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Hover/focus-revealed tooltip.
	 *
	 * The parent element controls visibility — it must be `position: relative`
	 * and add a CSS rule like:
	 *
	 * ```scss
	 * .parent:hover :global(.tooltip),
	 * .parent:focus-within :global(.tooltip) {
	 *   opacity: 1;
	 *   visibility: visible;
	 * }
	 * ```
	 *
	 * Styling is opaque (card background + border) so contents stay readable
	 * over any backdrop. Use `placement` to position above (default) or below.
	 */
	let {
		children,
		placement = 'top'
	}: { children: Snippet; placement?: 'top' | 'bottom' } = $props();
</script>

<span class={['tooltip', placement]} role="tooltip">
	{@render children()}
</span>

<style lang="scss">
	.tooltip {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		background: #6f6af8;
		border-radius: 8px;
		padding: 0.4rem 0.7rem;
		font-size: 0.7rem;
		font-weight: 600;
		color: #fff;
		white-space: nowrap;
		pointer-events: none;
		z-index: 10;
		box-shadow: 0 4px 14px rgba(111, 106, 248, 0.35);
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.12s ease,
			visibility 0.12s ease;
	}
	.tooltip.top {
		bottom: calc(100% + 0.5rem);
	}
	.tooltip.bottom {
		top: calc(100% + 0.5rem);
	}
</style>
