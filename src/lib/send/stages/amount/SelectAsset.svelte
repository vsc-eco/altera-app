<script lang="ts">
	import { Network, type CoinOptions } from '$lib/send/sendOptions';
	import { type CoinOptionParam } from '$lib/send/sendUtils';
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { networkCard, type AssetObject } from '../components/SendSnippets.svelte';
	import { untrack } from 'svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowLeft, ChevronRight, Delete } from '@lucide/svelte';
	import AssetInfo from '../components/AssetInfo.svelte';

	let {
		availableCoins,
		close
	}: {
		availableCoins: AssetObject[];
		close: () => void;
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
	let tmpAssetVal: string | undefined = $state($SendTxDetails.toCoin?.coin.value);
	const availableCoinOpts: CoinOptionParam[] = availableCoins
		.map((coin) => coin.snippetData.fromOpt)
		.filter((item): item is CoinOptionParam => item !== undefined);

	$effect(() => {
		const newVal = tmpAssetVal;
		untrack(() => {
			tmpAsset = availableCoinOpts.find((coinOpts) => coinOpts.coin.value === newVal);
			if (!tmpAsset) {
				$SendTxDetails.toCoin = undefined;
				return;
			}
			if ($SendTxDetails.toCoin?.coin.value === tmpAsset.coin.value) return;
			detailsOpen = { fromOpt: tmpAsset, net: tmpNetwork };
			$SendTxDetails.toCoin = tmpAsset;
		});
	});

	let tmpNetwork: Network | undefined = $state();
	let tmpNetworkVal: string | undefined = $state();
	$effect(() => {
		const newFromNetwork = $SendTxDetails.fromNetwork;
		untrack(() => {
			if (newFromNetwork === undefined && tmpNetworkVal) {
				tmpNetworkVal = undefined;
			}
		});
	});
	const allNetworks = Object.values(Network);
	$effect(() => {
		const newVal = tmpNetworkVal;
		untrack(() => {
			tmpNetwork = allNetworks.find((net) => net.value === newVal);
			if (!tmpNetwork) return;
			if ($SendTxDetails.fromNetwork?.value === tmpNetwork?.value) return;
			$SendTxDetails.fromNetwork = tmpNetwork;
			close();
		});
	});

	let detailsOpen = $state<AssetObject['snippetData']>();
</script>

<div class="dialog-content">
	{#if detailsOpen}
		<PillButton onclick={() => (detailsOpen = undefined)} styleType="icon-subtle">
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
			<!-- <div class="radio-wrapper">
				<RadioGroup
					items={networks}
					bind:value={tmpNetworkVal}
					defaultValue={$SendTxDetails.fromNetwork?.value}
				/>
			</div> -->
			<ListBox items={networks} bind:value={tmpNetworkVal} input={false} />
		{/if}
	{:else}
		<br />
		<h5>Select an Asset</h5>
		<div class="listbox-wrapper">
			<ListBox items={listItems} bind:value={tmpAssetVal} />
		</div>
		{#if $SendTxDetails.fromNetwork}
			<div class="from-network">
				<span class="sm-caption">Selecting assets available on network:</span>
				<div class="network-details">
					<img src={$SendTxDetails.fromNetwork.icon} alt={$SendTxDetails.fromNetwork.label} />
					{$SendTxDetails.fromNetwork.label}
					<span class="clear-button">
						<PillButton
							onclick={() => ($SendTxDetails.fromNetwork = undefined)}
							styleType="text-subtle"
						>
							<span class="clear-button-text">
								<Delete size="16" />
								Clear
							</span>
						</PillButton>
					</span>
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
	// h2 {
	// 	color: var(--neutral-fg);
	// 	font-size: var(--text-1xl);
	// 	margin-top: 1.5rem;
	// 	font-weight: 450;
	// }
	.from-network {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.network-details {
			img {
				width: 2rem;
			}
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
