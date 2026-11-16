<script lang="ts">
	/**
	 * The one "working on it" mark.
	 *
	 * Pages used to each roll their own: a `WaveLoading`, a bare `Loading…`,
	 * a CSS ring written inline. They disagreed on size and colour, so a
	 * screen with two of them looked like two bugs.
	 *
	 * `label` is read out to a screen reader and is otherwise invisible;
	 * pass `inline` to sit it next to text instead of centred in a block.
	 */
	let {
		size = 20,
		label = 'Loading',
		inline = false
	}: {
		/** Diameter in px. */
		size?: number;
		/** What is loading — announced, not drawn. */
		label?: string;
		/** Flow with surrounding text instead of centring in its own row. */
		inline?: boolean;
	} = $props();
</script>

<span class="wrap" class:inline role="status" aria-live="polite">
	<span class="ring" style:--spinner-size="{size}px"></span>
	<span class="sr">{label}</span>
</span>

<style lang="scss">
	.wrap {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 12px 0;
	}
	.wrap.inline {
		display: inline-flex;
		width: auto;
		padding: 0;
		vertical-align: middle;
	}
	.ring {
		box-sizing: border-box;
		display: block;
		width: var(--spinner-size);
		height: var(--spinner-size);
		border-radius: 999px;
		border: 2px solid var(--alt-card-border, rgba(255, 255, 255, 0.18));
		border-top-color: var(--alt-accent, #6f6af8);
		animation: alt-spin 0.7s linear infinite;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.ring {
			animation-duration: 2.4s;
		}
	}
</style>
