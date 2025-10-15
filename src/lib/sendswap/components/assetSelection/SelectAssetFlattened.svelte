<script lang="ts">
	import { Coin, Network, type CoinOptions } from '$lib/sendswap/utils/sendOptions';
	import { type CoinOptionParam } from '$lib/sendswap/utils/sendUtils';
	import { type AssetObject } from '../info/SendSnippets.svelte';
	import { untrack, type Snippet } from 'svelte';
	import AssetList from './AssetList.svelte';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getAuth } from '$lib/auth/store';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import BalanceInfo from '../info/BalanceInfo.svelte';

	let {
		availableCoins,
		coin = $bindable(),
		network = $bindable(),
		max = $bindable(),
		close,
		externalNetwork
	}: {
		availableCoins: AssetObject[];
		coin: CoinOptions['coins'][number] | undefined;
		network: Network | undefined;
		max?: CoinAmount<Coin> | undefined;
		close: () => void;
		externalNetwork?: Network;
	} = $props();

	const auth = $derived(getAuth()());

	const onVSC = availableCoins.filter((coin) => coin.value in $accountBalance.bal);

	interface BalanceObject extends Coin {
		balance: string;
		onNetwork: Network;
		snippet: (...args: any[]) => ReturnType<Snippet>;
	}
	const vscItems: BalanceObject[] = onVSC
		.map((coin) => {
			const coinAmt = new CoinAmount(
				$accountBalance.bal[coin.value as keyof AccountBalance],
				coin,
				true
			);
			if (coinAmt.amount > 0) {
				return {
					...coin,
					value: `${coin.value}:${Network.vsc.value}`,
					balance: coinAmt.toPrettyAmountString(),
					onNetwork: Network.vsc,
					snippet: assetBalance,
					snippetData: undefined
				};
			}
		})
		.filter((coin) => coin !== undefined);

	let externalItems: BalanceObject[] = $state([]);
	let loading = $state(false);
	$effect(() => {
		if (!auth || auth.value?.provider !== 'aioha') return;
		if (externalNetwork?.value !== Network.hiveMainnet.value) return;
		untrack(() => {
			if (!$accountBalance.connectedBal) return;
			loading = true;

			let result: BalanceObject[] = [];

			for (const [coinVal, bal] of Object.entries($accountBalance.connectedBal)) {
				const coin = Object.values(Coin).find((coin) => coin.value === coinVal);
				if (!coin) continue;
				result.push({
					...coin,
					value: `${coin.value}:${externalNetwork.value}`,
					balance: new CoinAmount(bal, coin, true).toPrettyAmountString(),
					onNetwork: externalNetwork,
					snippet: assetBalance
				});
			}
			externalItems = result;
			loading = false;
		});
	});

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

	$inspect('vscitems', vscItems);
	$inspect('externalitems', externalItems);

	function handleAssetClick(balanceVal: string) {
		const assetVal = balanceVal.split(':')[0];
		const networkVal = balanceVal.split(':')[1];
		const balanceObj = [...vscItems, ...externalItems].find((item) => item.value === balanceVal);
		tmpAsset = availableCoinOpts.find((coinOpts) => coinOpts.coin.value === assetVal);
		tmpNetwork =
			[Network.vsc, externalNetwork].find((net) => net?.value === networkVal) ?? Network.vsc;
		if (!tmpAsset) {
			coin = undefined;
			network = undefined;
			max = undefined;
		} else {
			network = tmpNetwork;
			coin = tmpAsset;
			if (balanceObj) {
				const coinObj: Coin = { ...balanceObj, value: assetVal };
				max = new CoinAmount(balanceObj.balance, coinObj);
			}
		}
		close();
		return;
	}
</script>

{#snippet assetBalance(coin: BalanceObject)}
	{@const properCoin: Coin = { ...coin, value: coin.value.split(':')[0] }}
	<BalanceInfo coin={properCoin} network={coin.onNetwork} size="large" />
{/snippet}

<div class="dialog-content">
	<h5>Select an Asset</h5>
	{#if loading}
		<div class="assets-loading"><WaveLoading /></div>
	{:else}
		<div class="listbox-wrapper">
			<AssetList
				items={[...vscItems, ...externalItems]}
				value={`${coin?.coin.value}:${network?.value}`}
				clickAsset={handleAssetClick}
				type="balance"
			/>
		</div>
	{/if}
</div>

<style lang="scss">
	.dialog-content {
		display: flex;
		flex-direction: column;
	}
	.assets-loading {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
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
