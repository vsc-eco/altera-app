<script lang="ts">
	import type { Coin, Network, UnknownCoin } from '$lib/send/sendOptions';

	let { coin, network }: { coin: UnknownCoin; network: Network } = $props();
</script>

<span class="icons" role="img" aria-label={`${coin.label} on ${network.label}`}>
	<img width="24" src={coin.icon} alt={`${coin.unit} on `} />
	<img width="12" src={network.icon} alt={`${network.label}`} />
</span>

<style>
	.icons {
		align-items: center;
		border-radius: 0.5rem 0 0 0.5rem;
		border-right-width: 0;
		height: 2rem;
		width: 2rem;
		box-sizing: border-box;
		justify-content: center;
		display: inline-flex;
		position: relative;

		align-items: center;
		img {
			background-color: var(--bg);
		}
		img:last-child {
			background-color: var(--bg);
			position: absolute;
			border: 2px solid var(--bg);
			border-radius: 50%;
			bottom: 0rem;
			left: 16px;
		}
	}
</style>
