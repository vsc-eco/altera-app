<script lang="ts">
	import SendSwap from '$lib/sendswap/SendSwap.svelte';
	import PoolsContent from '$lib/pools/PoolsContent.svelte';
	import Tabs from '$lib/zag/Tabs.svelte';
	import { page } from '$app/state';

	const defaultTab = $derived(page.url.searchParams.get('tab') ?? 'swap');
</script>

<document:head>
	<title>Swap</title>
</document:head>

<div class="swap-page">
	<div class="swap-page-header">
		<div class="header-top">
			<span class="status-dot"></span>
			<span class="badge-text">MAGI CROSS-CHAIN</span>
		</div>
	</div>
	{#key defaultTab}
		<Tabs
			defaultValue={defaultTab}
			items={[
				{ value: 'swap', label: 'Swap', content: swapContent },
				{ value: 'pools', label: 'Pools', content: poolsContent }
			]}
		/>
	{/key}
</div>

{#snippet swapContent()}
	<div class="tab-panel send-internal-wrapper">
		<SendSwap txType="swap" />
	</div>
{/snippet}

{#snippet poolsContent()}
	<div class="tab-panel">
		<PoolsContent />
	</div>
{/snippet}

<style lang="scss">
	.swap-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.swap-page-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem 1rem 0.75rem;
	}
	.header-top {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--dash-accent-green);
	}
	.badge-text {
		color: var(--dash-text-muted);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.1em;
	}
	.swap-page-subtitle {
		color: var(--dash-text-muted);
		font-size: 0.8rem;
		margin: 0.125rem 0 0;
	}

	.swap-page :global([data-part='root']) {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.swap-page :global([data-part='content']) {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	/* Style the tab triggers */
	.swap-page :global([data-part='list']) {
		justify-content: center;
	}
	.swap-page :global([data-part='trigger']) {
		color: var(--dash-text-muted);
		font-weight: 500;
		&[data-state='active'] {
			color: var(--dash-text-primary);
		}
	}

	.tab-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.send-internal-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
</style>
