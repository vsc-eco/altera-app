<script lang="ts">
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { networkMap, type IntermediaryNetwork, type Network } from '../../utils/sendOptions';
	import InfoSegment from './InfoSegment.svelte';

	let {
		network,
		lastPaid,
		disabledMemo,
		size = 'small',
		hideDetails = false
	}: {
		network: IntermediaryNetwork | Network;
		lastPaid?: string;
		disabledMemo?: string;
		size?: 'small' | 'medium' | 'large';
		hideDetails?: boolean;
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
		if (hideDetails) return [];
		let result = [numAssets];
		if (lastPaid) {
			result.push(`Last paid ${lastPaid}`);
		}
		return result;
	});
	const imgSize = $derived.by(() => {
		switch (size) {
			case 'medium':
				return 16 * 2.5;
			case 'large':
				return 16 * 3.5;
			default:
				return 16 * 1.5;
		}
	});
</script>

<div class="wrapper">
	<div class={{ gray: disabledMemo !== undefined }}>
		<ImageIconRenderer icon={network.icon} alt={network.label} size={imgSize} />
	</div>
	<InfoSegment label={network.label} {display} disabled={disabledMemo !== undefined} {size} />
</div>

<style>
	.gray {
		filter: grayscale(100%);
	}
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-grow: 1;
	}
</style>
