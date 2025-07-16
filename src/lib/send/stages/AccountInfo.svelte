<script lang="ts">
	import { Network, type Coin, type CoinOptions, type IntermediaryNetwork } from "../sendOptions";

    let {
        coinOpt,
        depositNetworks
    } : {
        coinOpt: CoinOptions['coins'][number];
        depositNetworks: (Network | IntermediaryNetwork)[];
    } = $props();

	const vsc = Network.vsc;
</script>

<!-- <div class="wrapper">
    <img src={network.icon} alt={network.label} class={{ large: !adjacent }} />
	<div class="name-details">
		<span class="name">
			{network.label}
		</span>
		<div class={['details', { adjacent: adjacent }]}>
			<span class="available-addresses">{numAssets}</span>
			<span class="last-paid">
				Last paid
				{lastPaid}
			</span>
		</div>
	</div>
</div> -->

<style>
	img {
		width: 2.5rem;
	}
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
		align-items: center;
		margin-top: 0.25rem;
		line-height: 1.2;
		font-size: var(--text-sm);
		margin-top: 0.5rem;
		color: var(--neutral-fg-mid);
	}
</style>