<script lang="ts">
	import { Network } from '$lib/send/sendOptions';
	import AssetInfo from '$lib/send/stages/components/AssetInfo.svelte';
	import { networkCard, type AssetObject } from '$lib/send/stages/components/SendSnippets.svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import { untrack } from 'svelte';

	let {
		open,
		network = $bindable(),
		close
	}: {
		open: AssetObject['snippetData'];
		network: Network | undefined;
		close: (all?: boolean) => void;
	} = $props();
	const networks = open.fromOpt?.networks.map((net) => ({
		...net,
		snippet: networkCard,
		snippetData: {
			net: net,
			size: 'medium'
		}
	}));

	let tmpNetwork: Network | undefined = $state();
	let tmpNetworkVal: string | undefined = $state();
	$effect(() => {
		const newNetwork = network;
		untrack(() => {
			if (newNetwork === undefined && tmpNetworkVal) {
				tmpNetworkVal = undefined;
			}
		});
	});
	const allNetworks = Object.values(Network);
	$effect(() => {
		const newVal = tmpNetworkVal;
		untrack(() => {
			tmpNetwork = allNetworks.find((net) => net.value === newVal);
			if (network?.value === tmpNetwork?.value) return;
			network = tmpNetwork;
			if (tmpNetwork) close(true);
		});
	});
</script>

<div class="dialog-content">
	{#if open.fromOpt}
		<div class="asset-label">
			<AssetInfo coinOpt={open.fromOpt} basic />
		</div>
	{/if}
	{#if networks}
		<p class="sm-caption">Available on networks:</p>
		<ListBox items={networks} bind:value={tmpNetworkVal} input={false} />
	{/if}
</div>

<style>
	.asset-label {
		padding: 0.5rem 0 1rem;
	}
</style>
