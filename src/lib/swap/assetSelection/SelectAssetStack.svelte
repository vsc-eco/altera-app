<script lang="ts">
	import { Network, type CoinOptions } from '$lib/send/sendOptions';
	import { type CoinOptionParam } from '$lib/send/sendUtils';
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { networkCard, type AssetObject } from '$lib/send/stages/components/SendSnippets.svelte';
	import { untrack, type Snippet } from 'svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowLeft, ChevronRight, Delete } from '@lucide/svelte';
	import AssetInfo from '$lib/send/stages/components/AssetInfo.svelte';
	import SelectAssetNetwork from './SelectAssetNetwork.svelte';

	let {
		availableCoins,
		coin = $bindable(),
		network = $bindable(),
		push,
		pop
	}: {
		availableCoins: AssetObject[];
		coin: CoinOptions['coins'][number] | undefined;
		network: Network | undefined;
		push: (snippet: (...args: any[]) => ReturnType<Snippet>, args?: any) => void;
		pop: (all?: boolean) => void;
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
	let tmpAssetVal: string | undefined = $state(coin?.coin.value);
	const availableCoinOpts: CoinOptionParam[] = availableCoins
		.map((coin) => coin.snippetData.fromOpt)
		.filter((item): item is CoinOptionParam => item !== undefined);

	$effect(() => {
		const newVal = tmpAssetVal;
		untrack(() => {
			tmpAsset = availableCoinOpts.find((coinOpts) => coinOpts.coin.value === newVal);
			if (!tmpAsset) {
				coin = undefined;
				return;
			}
			if (coin?.coin.value === tmpAsset.coin.value) return;
			coin = tmpAsset;
			push(selectNetwork, { fromOpt: tmpAsset, net: network });
		});
	});
</script>

{#snippet selectNetwork(open: AssetObject['snippetData'])}
	<SelectAssetNetwork {open} bind:network close={pop} />
{/snippet}

<div class="dialog-content">
	<br />
	<h5>Select an Asset</h5>
	<div class="listbox-wrapper">
		<ListBox items={listItems} bind:value={tmpAssetVal} />
	</div>
	{#if network}
		<div class="from-network">
			<span class="sm-caption">Selecting assets available on network:</span>
			<div class="network-details">
				<img src={network.icon} alt={network.label} />
				{network.label}
				<span class="clear-button">
					<PillButton onclick={() => (network = undefined)} styleType="text-subtle">
						<span class="clear-button-text">
							<Delete size="16" />
							Clear
						</span>
					</PillButton>
				</span>
			</div>
		</div>
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
