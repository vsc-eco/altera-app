<script lang="ts">
	import PoolsContent from '$lib/pools/PoolsContent.svelte';
	import Tabs from '$lib/zag/Tabs.svelte';
	import { page } from '$app/state';

	/** The redesign splits Pools out of the swap page, so the old
	 *  `/swap?tab=custom-pools` link lands here with `?kind=custom`. */
	const defaultTab = $derived(page.url.searchParams.get('kind') === 'custom' ? 'custom' : 'standard');
</script>

<svelte:head>
	<title>Pools</title>
</svelte:head>

<div class="pools-page">
	<h1>Pools</h1>
	{#key defaultTab}
		<Tabs
			defaultValue={defaultTab}
			items={[
				{ value: 'standard', label: 'Pools', content: standardContent },
				{ value: 'custom', label: 'Custom pools', content: customContent }
			]}
		/>
	{/key}
</div>

{#snippet standardContent()}
	<PoolsContent kind="standard" />
{/snippet}

<!-- Pools with a Magi custom token on one side. Same table, same actions —
     split out only so they don't crowd the core HIVE/HBD/BTC pools. -->
{#snippet customContent()}
	<PoolsContent kind="custom" />
{/snippet}

<style lang="scss">
	.pools-page {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	h1 {
		font-size: 26px;
		font-weight: 700;
		margin: 0;
		color: var(--alt-tx);
	}
	.pools-page :global([data-part='trigger']) {
		color: var(--alt-tx-2);
		font-weight: 600;
		&[data-state='active'] {
			color: var(--alt-tx);
			font-weight: 700;
		}
	}
</style>
