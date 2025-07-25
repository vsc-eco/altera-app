<script lang="ts">
	import { networkMap, type IntermediaryNetwork, type Network } from '../sendOptions';
	import { Dot } from '@lucide/svelte';

	let {
		network,
		lastPaid,
		adjacent = false
	}: {
		network: IntermediaryNetwork | Network;
		lastPaid: string;
		adjacent?: boolean;
	} = $props();
	const numAssets = $derived.by(() => {
		const coins = networkMap.get(network.value);
		if (!coins || coins.length === 0) {
			return 'No Assets Available';
		}
		if (coins.length === 1) {
			return '1 Asset Available';
		}
		return `${coins.length} Assets Available`;
	});
</script>

<div class="wrapper">
	<img src={network.icon} alt={network.label} class={{ large: !adjacent }} />
	<div class="name-details">
		<span class="name">
			{network.label}
		</span>
		<div class={['details', { adjacent: adjacent }]}>
			<span class="available-addresses">{numAssets}</span>
			{#if adjacent}
				<Dot />
			{/if}
			<span class="last-paid">
				Last paid
				{lastPaid}
			</span>
		</div>
	</div>
</div>

<style>
	img {
		width: 2.5rem;
	}
	img.large {
		width: 3.5rem;
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
		flex-direction: column;
		line-height: 1.2;
		font-size: var(--text-sm);
		margin-top: 0.5rem;
		color: var(--neutral-fg-mid);
	}
	.details.adjacent {
		flex-direction: row;
		align-items: center;
		margin-top: 0.25rem;
	}
	.name {
		text-align: left;
	}
</style>
