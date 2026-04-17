<script lang="ts">
	import type { Coin, Network } from '$lib/sendswap/utils/sendOptions';

	let {
		coin,
		network,
		size = 24,
		hideNetwork = false
	}: { coin: Coin; network: Network; size?: number; hideNetwork?: boolean } = $props();
</script>

<span
	class={['icons neutral', { showNetwork: !hideNetwork }]}
	role="img"
	aria-label={`${coin.label} on ${network.label}`}
	style="--size: calc({size}px + 0.5rem)"
>
	<img width={size} src={coin.icon} alt={`${coin.unit} on ${network.label}`} />
	{#if network.icon && typeof network.icon === 'string' && !hideNetwork}
		<img width={size / 2} height={size / 2} src={network.icon} alt={`${network.label}`} />
	{/if}
</span>

<style lang="scss">
	.icons {
		align-items: center;
		border-radius: 0.5rem 0 0 0.5rem;
		border-right-width: 0;
		height: var(--size, 2rem);
		width: var(--size, 2rem);
		box-sizing: border-box;
		justify-content: center;
		display: inline-flex;
		position: relative;

		.showNetwork {
			img:last-child {
				background-color: rgba(0, 0, 0, 0.4);
				position: absolute;
				border: 2px solid rgba(0, 0, 0, 0.4);
				border-radius: 50%;
				bottom: 0rem;
				left: calc(var(--size, 2rem) / 2);
			}
		}
	}
</style>
