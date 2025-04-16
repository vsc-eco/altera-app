<script lang="ts">
	import type { Coin, Network } from '$lib/send/sendOptions';

	let { coin, network }: { coin: Coin; network: Network } = $props();
</script>

<span class="icons">
	<img width="24" src={coin.icon} alt={coin.label} />
	<img width="12" src={network.icon} alt={network.label} />
</span>

<style>
	.icons {
		align-items: center;
		border-radius: 0.5rem 0 0 0.5rem;
		border-right-width: 0;
		padding: 0.25rem;
		height: 3rem;
		padding-left: 0.5rem;
		width: 2.25rem;
		box-sizing: border-box;
		display: inline-flex;
		position: relative;
		justify-content: left;
		align-items: center;
		img {
			background-color: var(--bg);
		}
		img:last-child {
			background-color: var(--bg);
			position: absolute;
			border: 2px solid var(--bg);
			border-radius: 50%;
			bottom: 0.5rem;
			left: 16px;
		}
	}
</style>
