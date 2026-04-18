<script lang="ts">
	import type { Coin } from '$lib/sendswap/utils/sendOptions';

	let {
		coin,
		mapped = false,
		size = 24
	}: {
		coin: Coin;
		/** True when the asset is the Magi-mapped representation of the
		 *  underlying chain asset (e.g. mBTC on VSC). When true, a small
		 *  Magi indicator badge is overlaid on the icon. */
		mapped?: boolean;
		size?: number;
	} = $props();
</script>

<span
	class="asset-icon"
	role="img"
	aria-label={mapped ? `${coin.label} (mapped via Magi)` : coin.label}
	style="--size: {size}px"
>
	<img class="coin" width={size} height={size} src={coin.icon} alt={coin.unit} />
	{#if mapped}
		<img
			class="mapped-badge"
			width={Math.max(10, Math.round(size * 0.45))}
			height={Math.max(10, Math.round(size * 0.45))}
			src="/magi.svg"
			alt="Magi mapped"
		/>
	{/if}
</span>

<style lang="scss">
	.asset-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: relative;
		width: var(--size, 24px);
		height: var(--size, 24px);
		flex-shrink: 0;
	}
	.coin {
		display: block;
		border-radius: 50%;
	}
	.mapped-badge {
		position: absolute;
		top: -2px;
		left: -2px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.55);
		padding: 1px;
		box-sizing: content-box;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}
</style>
