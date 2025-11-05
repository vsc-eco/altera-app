<script lang="ts">
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { Network } from '$lib/sendswap/utils/sendOptions';
	import { ArrowRight, Globe } from '@lucide/svelte';

	type TransferType = {
		value: 'internal' | 'external';
		to?: Network;
		from?: Network;
		disabledMemo?: string;
	};
	let { value, to, from, disabledMemo }: TransferType = $props();

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

<div class={['bar', { disabled: !!disabledMemo }]}>
	{#if to && from}
		{value === 'internal' ? 'Internal Transfer' : 'External Transfer'}
		{#if disabledMemo}
			<span class="error">{disabledMemo}</span>
		{:else}
			<div class="net-arrows">
				{@render basicNetLabel(from)}
				<ArrowRight />
				{@render basicNetLabel(to)}
			</div>
		{/if}
	{:else}
		{value === 'internal' ? 'Internal Transfer' : 'External Transfer'}
		{#if disabledMemo}
			<span class="error">{disabledMemo}</span>
		{:else}
			<div class="net-arrows">
				<ArrowRight />
				{#if value === 'internal'}
					{@render basicNetLabel(Network.magi)}
				{:else}
					{@render basicNetLabel(externalPlaceholder)}
				{/if}
			</div>
		{/if}
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
	.disabled {
		filter: grayscale(50%);
		color: var(--neutral-mid);
	}
</style>
