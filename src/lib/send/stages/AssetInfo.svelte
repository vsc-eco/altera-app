<script lang="ts">
	import type { Coin, CoinOptions, Network } from "../sendOptions";

    let {
        coinOpt,
        network
    } : {
        coinOpt: CoinOptions['coins'][number];
        network?: Network | undefined;
    } = $props();
</script>

<div>
    <img src={coinOpt.coin.icon} alt={coinOpt.coin.label} />
    <div class="name-details">
		<span class="name">
			{coinOpt.coin.label}
		</span>
		<div class='details'>
			<span class="coin-label">{coinOpt.coin.label}</span>
			<!-- <Dot /> -->
			<span class="on-network">
				{`From ${coinOpt.networks.length} networks`}
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
</style>