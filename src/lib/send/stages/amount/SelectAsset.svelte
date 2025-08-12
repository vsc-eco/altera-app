<script lang="ts">
	import swapOptions, { Network, type CoinOptions } from '$lib/send/sendOptions';
	import { type CoinOptionParam } from '$lib/send/sendUtils';
	import { getUsernameFromDid } from '$lib/getAccountName';
	import { authStore } from '$lib/auth/store';
	import { vscTxsStore, waitForExtend } from '$lib/stores/txStores';
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { type AssetObject } from '../components/CardSnippets.svelte';
	import { untrack } from 'svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowLeft, Delete } from '@lucide/svelte';
	import AssetInfo from '../components/AssetInfo.svelte';

	let {
		availableCoins
	}: {
		availableCoins: AssetObject[];
	} = $props();

	const listItems = $derived(
		availableCoins.map((coin) => ({
			...coin,
			edit: (coin: AssetObject) => (detailsOpen = coin.snippetData),
			buttonType: 'Chevron'
		}))
	);

	const auth = $derived($authStore);
	let tmpAsset: CoinOptions['coins'][number] | undefined = $state();
	let tmpAssetVal: string | undefined = $state();
	const availableCoinOpts: CoinOptionParam[] = availableCoins
		.map((coin) => coin.snippetData.fromOpt)
		.filter((item): item is CoinOptionParam => item !== undefined);

	$effect(() => {
		const newVal = tmpAssetVal;
		untrack(() => {
			tmpAsset = availableCoinOpts.find((coinOpts) => coinOpts.coin.value === newVal);
			if (!tmpAsset) return;
			if ($SendTxDetails.toCoin?.coin.value === tmpAsset.coin.value) return;
			SendTxDetails.update((current) => ({
				...current,
				toCoin: tmpAsset
			}));
		});
	});

	type coinData = {
		coinOpt: CoinOptionParam;
		date: string | undefined;
	};

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
			SendTxDetails.update((current) => ({
				...current,
				fromNetwork: tmpNetwork
			}));
		});
	});

	function clearFromNetwork() {
		SendTxDetails.update((current) => ({
			...current,
			fromNetwork: undefined
		}));
	}

	let detailsOpen = $state<AssetObject['snippetData']>();
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

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
			snippet: radioLabel
		}))}
		{#if networks}
			<p class="sm-caption">Available on networks:</p>
			<div class="radio-wrapper">
				<RadioGroup
					items={networks}
					bind:value={tmpNetworkVal}
					defaultValue={$SendTxDetails.fromNetwork?.value}
				/>
			</div>
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
						<PillButton onclick={clearFromNetwork} styleType="text-subtle">
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
	.radio-wrapper {
		margin-top: 0.5rem;
		width: fit-content;
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
