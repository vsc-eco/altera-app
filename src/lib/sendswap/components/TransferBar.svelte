<script lang="ts">
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { Network } from '$lib/sendswap/utils/sendOptions';
	import { ArrowRight, Globe } from '@lucide/svelte';

	type TransferType = {
		value: 'internal' | 'external';
		to?: Network;
		from?: Network;
	};
	let { params }: { params: TransferType } = $props();

	const externalPlaceholder: Network = {
		value: 'external',
		label: 'External Network',
		icon: Globe
	};
</script>

{#snippet basicNetLabel(net: Network)}
	<div class="net-label">
		<ImageIconRenderer icon={net.icon} alt={net.label} />
		{net.label}
	</div>
{/snippet}

<div class="bar">
	{#if params.to && params.from}
		{params.value === 'internal' ? 'Internal Transfer' : 'External Transfer'}
		<div class="net-arrows">
			{@render basicNetLabel(params.from)}
			<ArrowRight />
			{@render basicNetLabel(params.to)}
		</div>
	{:else}
		{params.value === 'internal' ? 'Internal Transfer' : 'External Transfer'}
		<div class="net-arrows">
			<ArrowRight />
			{#if params.value === 'internal'}
				{@render basicNetLabel(Network.vsc)}
			{:else}
				{@render basicNetLabel(externalPlaceholder)}
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	.net-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 3rem;
		width: 100%;
	}
	.net-arrows {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
