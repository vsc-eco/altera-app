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

	let {
		availableCoins
	}: {
		availableCoins: AssetObject[];
	} = $props();

	const listItems = $derived(
		availableCoins.map((coin) => ({
			...coin,
			details: radioNetworkFromCoin
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

	async function getRecentAssets(): Promise<coinData[]> {
		if (!auth.value) return [];
		let result = new Map<string, coinData>();
		let leaveOut = ['v4vapp'];
		let lastChecked = 0;
		let lastLength = 0;
		do {
			lastLength = $vscTxsStore.length;
			for (const tx of $vscTxsStore.slice(lastChecked)) {
				if (!tx.ops) continue;
				for (const op of tx.ops) {
					const coin = availableCoinOpts.find((coinOpt) =>
						coinOpt.coin.value.startsWith(op?.data.asset)
					);
					if (!coin || !op || op.data.from !== auth.value.did || !op.data.to) continue;
					const username = getUsernameFromDid(op.data.to);
					if (!leaveOut.includes(username) && !result.has(op?.data.asset)) {
						result.set(op?.data.asset, {
							coinOpt: coin,
							date: tx.anchr_ts + 'Z'
						});
						break;
					}
					if (result.size >= availableCoinOpts.length) {
						return [...result.values()];
					}
				}
			}
			lastChecked = Math.max($vscTxsStore.length - 1, 0);
			const success = await waitForExtend(auth.value.did, 30);
			if (!success) {
				break;
			}
		} while ($vscTxsStore.length > lastLength);

		for (const tx of $vscTxsStore) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				const coin = availableCoinOpts.find((coinOpt) => coinOpt.coin.value.startsWith(tx.type));
				if (!coin || !op || !op.data.from) continue;
				const username = getUsernameFromDid(op.data.from);
				if (!leaveOut.includes(username) && !result.has(tx.type)) {
					result.set(tx.type, {
						coinOpt: coin,
						date: tx.anchr_ts + 'Z'
					});
					break;
				}
				if (result.size >= availableCoinOpts.length) {
					return [...result.values()];
				}
			}
		}

		return [...result.values()];
	}
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

{#snippet radioNetworkFromCoin(data: AssetObject['snippetData'])}
	{@const networks = data.fromOpt?.networks.map((net) => ({
		...net,
		snippet: radioLabel
	}))}
	{#if networks}
		<p class="sm-caption">Available on networks:</p>
		<div class="radio-wrapper">
			<RadioGroup items={networks} bind:value={tmpNetworkVal} />
		</div>
	{/if}
{/snippet}

<div class="wrapper">
	<br />
	<h2>Select an Asset</h2>
	{#if $SendTxDetails.fromNetwork}
		<div class="from-network">
			<span class="sm-caption">Selecting assets available on network:</span>
			<div class="network-details">
				<img src={$SendTxDetails.fromNetwork.icon} alt={$SendTxDetails.fromNetwork.label} />
				{$SendTxDetails.fromNetwork.label}
			</div>
		</div>
	{/if}
	<div class="listbox-wrapper">
		<ListBox items={listItems} bind:value={tmpAssetVal} />
	</div>
</div>

<style lang="scss">
	.wrapper {
		margin: auto;
		min-width: min-content;
		width: 32rem;
	}
	h2 {
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-top: 1.5rem;
		font-weight: 450;
	}
	.from-network {
		margin-bottom: 1rem;
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
