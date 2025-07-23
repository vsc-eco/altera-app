<script lang="ts">
	import type { Coin, CoinOptions, Network } from '../sendOptions';

	let {
		coinOpt,
		network
	}: {
		coinOpt: CoinOptions['coins'][number];
		network?: Network | undefined;
	} = $props();
</script>

<div class="wrapper">
	<img src={coinOpt.coin.icon} alt={coinOpt.coin.label} />
	<div class="name-details">
		<span class="name">
			{coinOpt.coin.label}
		</span>
		<div class="details">
			<span class="on-network">
				{`From ${coinOpt.networks.length} network${coinOpt.networks.length != 1 ? 's' : ''}`}
				{#if network}
					| On {network.label}
				{/if}
			</span>
		</div>
	</div>
</div>

<style>
	img {
		width: 2.5rem;
	}
	/* img.large {
		width: 3.5rem;
	} */
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.name-details {
		display: flex;
		flex-direction: column;
	}
	.details {
		display: flex;
		flex-direction: row;
		line-height: 1.2;
		font-size: var(--text-sm);
		margin-top: 0.5rem;
		color: var(--neutral-fg-mid);
		align-items: center;
		margin-top: 0.25rem;
	}
	.name {
		text-align: left;
	}
</style>
