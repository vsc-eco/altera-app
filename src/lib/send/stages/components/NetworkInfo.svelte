<script lang="ts">
	import { networkMap, type IntermediaryNetwork, type Network } from '../../sendOptions';
	import InfoSegment from './InfoSegment.svelte';

	let {
		network,
		lastPaid,
		disabledMemo,
		size = 'small'
	}: {
		network: IntermediaryNetwork | Network;
		lastPaid?: string;
		disabledMemo?: string;
		size?: 'small' | 'medium' | 'large';
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
	let display = $derived.by(() => {
		if (disabledMemo) return [disabledMemo];
		let result = [numAssets];
		if (lastPaid) {
			result.push(`Last paid ${lastPaid}`);
		}
		return result;
	});
</script>

<div class="wrapper">
	<img
		src={network.icon}
		alt={network.label}
		class={{ medium: size === 'medium', large: size === 'large', gray: disabledMemo !== undefined }}
	/>
	<InfoSegment
		label={network.label}
		{display}
		disabled={disabledMemo !== undefined}
		{size}
	/>
</div>

<style>
	img {
		width: 1.5rem;
	}
	img.medium {
		width: 2.5rem;
	}
	img.large {
		width: 3.5rem;
	}
	img.gray {
		filter: grayscale(100%);
	}
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-grow: 1;
	}
</style>
