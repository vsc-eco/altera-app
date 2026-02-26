<script>
	import SendSwap from '$lib/sendswap/SendSwap.svelte';
	import PoolsContent from '$lib/pools/PoolsContent.svelte';
	import Tabs from '$lib/zag/Tabs.svelte';
</script>

<document:head>
	<title>Swap</title>
</document:head>

<div class="swap-page">
	<Tabs
		items={[
			{ value: 'swap', label: 'Swap', content: swapContent },
			{ value: 'pools', label: 'Pools', content: poolsContent }
		]}
	/>
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
