<script lang="ts">
	import { Network, type CoinOptions } from '$lib/sendswap/utils/sendOptions';
	import { type CoinOptionParam } from '$lib/sendswap/utils/sendUtils';
	import { type AssetObject, networkCard } from '../info/SendSnippets.svelte';
	import { untrack } from 'svelte';
	import AssetList from './AssetList.svelte';
	import AssetInfo from '../info/AssetInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowLeft, ChevronRight, Delete } from '@lucide/svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';

	let {
		availableCoins,
		coin = $bindable(),
		network = $bindable(),
		close,
		lockedNetwork
	}: {
		availableCoins: AssetObject[];
		coin: CoinOptions['coins'][number] | undefined;
		network: Network | undefined;
		close: () => void;
		lockedNetwork?: Network;
	} = $props();

	const listItems = $derived(
		availableCoins.map((coin) => ({
			...coin,
			icons: [
				{
					icon: ChevronRight
				}
			]
		}))
	);

	let tmpAsset: CoinOptions['coins'][number] | undefined = $state();
	const availableCoinOpts: CoinOptionParam[] = availableCoins
		.map((coin) => coin.snippetData.fromOpt)
		.filter((item): item is CoinOptionParam => item !== undefined);

	let tmpNetwork: Network | undefined = $state();
	let tmpNetworkVal: string | undefined = $state();
	$effect(() => {
		const newFromNetwork = network;
		untrack(() => {
			if (newFromNetwork === undefined && tmpNetworkVal) {
				tmpNetworkVal = undefined;
			}
		});
	});
	const allNetworks = Object.values(Network);

	function back() {
		detailsOpen = undefined;
	}

	let currentNetworkVal = $state(network?.value);
	function handleAssetClick(assetVal: string) {
		tmpAsset = availableCoinOpts.find((coinOpts) => coinOpts.coin.value === assetVal);
		if (lockedNetwork) {
			coin = tmpAsset;
			close();
		} else {
			if (!tmpAsset) {
				coin = undefined;
				close();
				return;
			}
			currentNetworkVal = assetVal === coin?.coin.value ? network?.value : undefined;
			detailsOpen = { fromOpt: tmpAsset, net: tmpNetwork };
		}
	}
	function handleNetworkClick(networkVal: string) {
		tmpNetwork = allNetworks.find((net) => net.value === networkVal);
		network = tmpNetwork;
		coin = tmpAsset;
		close();
	}

	let detailsOpen = $state<AssetObject['snippetData']>();
</script>

<div class="dialog-content">
	{#if detailsOpen}
		<PillButton onclick={back} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
		{#if detailsOpen.fromOpt}
			<div class="asset-label">
				<AssetInfo coinOpt={detailsOpen.fromOpt} basic />
			</div>
		{/if}
		{@const networks = detailsOpen.fromOpt?.networks.map((net) => ({
			...net,
			snippet: networkCard,
			snippetData: {
				net: net,
				size: 'medium'
			}
		}))}
		{#if networks}
			<p class="sm-caption">Available on networks:</p>
			<!-- <ListBox items={networks} bind:value={tmpNetworkVal} input={false} /> -->
			<AssetList
				items={networks}
				value={currentNetworkVal}
				clickAsset={handleNetworkClick}
				type="network"
			/>
		{/if}
	{:else}
		<br />
		<h5>Select an Asset</h5>
		<div class="listbox-wrapper">
			<!-- <ListBox items={listItems} bind:value={tmpAssetVal} /> -->
			<AssetList items={availableCoins} value={coin?.coin.value} clickAsset={handleAssetClick} />
		</div>
		{#if network}
			<div class="from-network">
				<span class="sm-caption">Selecting assets available on network:</span>
				<div class="network-details">
					<ImageIconRenderer icon={network.icon} />
					{network.label}
					{#if !lockedNetwork}
						<span class="clear-button">
							<PillButton onclick={() => (network = undefined)} styleType="text-subtle">
								<span class="clear-button-text">
									<Delete size="16" />
									Clear
								</span>
							</PillButton>
						</span>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.dialog-content {
		display: flex;
		flex-direction: column;
	}
	.from-network {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.network-details {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
	}
	.clear-button {
		margin-left: auto;
		.clear-button-text {
			color: var(--secondary-mid);
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}
	}
	.asset-label {
		padding: 0.5rem 0 1rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
