<script lang="ts">
	/**
	 * The two overlapping coin circles that stand for a pool's pair.
	 *
	 * Written out three times — twice in PoolsContent, once in PoolDetail —
	 * each with its own fallback for an asset with no icon file. A custom
	 * token usually has none, so the fallback is the common case, not the
	 * edge case.
	 */
	import { assetIcon } from '$lib/tokens/assetIcon';

	let {
		symbols,
		size = 1.5
	}: {
		/** `[asset0, asset1]`, as they appear in the pair label. */
		symbols: [string, string];
		/** Diameter in rem. */
		size?: number;
	} = $props();
</script>

<span class="pair-icons" style:--pair-icon-size="{size}rem" aria-hidden="true">
	{#each symbols as symbol, i (i)}
		{@const src = assetIcon(symbol)}
		{#if src}
			<img class="coin-icon" {src} alt={symbol} />
		{:else}
			<span class="icon" class:second={i === 1}>{symbol.slice(0, 3)}</span>
		{/if}
	{/each}
</span>

<style lang="scss">
	.pair-icons {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		flex: none;
	}
	.icon,
	.coin-icon {
		box-sizing: border-box;
		width: var(--pair-icon-size);
		height: var(--pair-icon-size);
		border-radius: 50%;
		/* The ring is the page behind, so the circles read as cut out of
		   each other rather than stacked. */
		border: 2px solid var(--alt-bg, var(--dash-bg));
		margin-left: calc(var(--pair-icon-size) * -0.23);
	}
	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--alt-field-2, var(--dash-surface-alt));
		font-size: calc(var(--pair-icon-size) * 0.33);
		font-weight: 600;
		color: var(--alt-tx-2, var(--dash-text-secondary));
		letter-spacing: 0.02em;
		overflow: hidden;
	}
	.icon.second {
		background-color: var(--alt-accent, var(--dash-accent-purple));
		color: #fff;
	}
	.icon:first-child,
	.coin-icon:first-child {
		margin-left: 0;
	}
</style>
