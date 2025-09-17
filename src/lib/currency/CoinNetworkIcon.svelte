<script lang="ts">
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import type { Coin, Network } from '$lib/sendswap/utils/sendOptions';

	let { coin, network, size = 24 }: { coin: Coin; network: Network; size?: number } = $props();
</script>

<span
	class="icons neutral"
	role="img"
	aria-label={`${coin.label} on ${network.label}`}
	style="--size: calc({size}px + 0.5rem)"
>
	<img width={size} src={coin.icon} alt={`${coin.unit} on ${network.label}`} />
	{#if typeof network.icon === 'string'}
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

		align-items: center;
		/* img {
			background-color: var(--bg);
		} */
		img:last-child {
			background-color: var(--bg);
			position: absolute;
			border: 2px solid var(--bg);
			border-radius: 50%;
			bottom: 0rem;
			left: calc(var(--size, 2rem) / 2);
		}
	}
</style>
