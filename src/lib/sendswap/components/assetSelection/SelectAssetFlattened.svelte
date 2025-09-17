<script lang="ts">
	import { Coin, Network, type CoinOptions } from '$lib/sendswap/utils/sendOptions';
	import { type CoinOptionParam } from '$lib/sendswap/utils/sendUtils';
	import { type AssetObject } from '../info/SendSnippets.svelte';
	import { untrack, type Snippet } from 'svelte';
	import AssetList from './AssetList.svelte';
	import AssetInfo from '../info/AssetInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowLeft, ChevronRight, Delete } from '@lucide/svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import AccBalance from '$lib/AccBalance.svelte';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { DHive } from '$lib/vscTransactions/dhive';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';

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
	const vscItems: BalanceObject[] = onVSC.map((coin) => ({
		...coin,
		value: `${coin.value}:${Network.vsc.value}`,
		balance: new CoinAmount(
			$accountBalance.bal[coin.value as keyof AccountBalance],
			coin,
			true
		).toPrettyAmountString(),
		onNetwork: Network.vsc,
		snippet: assetBalance,
		snippetData: undefined
	}));

	let externalItems: BalanceObject[] = $state([]);
	let loading = $state(false);
	$effect(() => {
		if (!auth || auth.value?.provider !== 'aioha') return;
		if (externalNetwork?.value !== Network.hiveMainnet.value) return;
		loading = true;
		untrack(() => {
			const username = getUsernameFromAuth(auth);
			if (!username) return;
			DHive.database.getAccounts([username]).then((accounts) => {
				const acc = accounts[0];
				const hiveBalance =
					typeof acc.balance === 'string'
						? parseFloat(acc.balance.split(' ')[0])
						: acc.balance.amount;
				const hbdBalance =
					typeof acc.hbd_balance === 'string'
						? parseFloat(acc.hbd_balance.split(' ')[0])
						: acc.hbd_balance.amount;
				let result: BalanceObject[] = [];
				if (hiveBalance > 0) {
					result.push({
						...Coin.hive,
						value: `${Coin.hive.value}:${externalNetwork.value}`,
						balance: hiveBalance.toString(),
						onNetwork: externalNetwork,
						snippet: assetBalance
					});
				}
				if (hbdBalance > 0) {
					result.push({
						...Coin.hbd,
						value: `${Coin.hbd.value}:${externalNetwork.value}`,
						balance: hbdBalance.toString(),
						onNetwork: externalNetwork,
						snippet: assetBalance
					});
				}
				externalItems = result;
				loading = false;
			});
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
				max = new CoinAmount(balanceObj.balance, balanceObj);
			}
		}
		close();
		return;
	}
</script>

{#snippet assetBalance(coin: BalanceObject)}
	<div class="asset-balance">
		<span class="img-label">
			<CoinNetworkIcon {coin} network={coin.onNetwork} size={40} />
			<span>
				{coin.label}
				<span class="sm-caption">on {coin.onNetwork.label}</span>
			</span>
		</span>
		<span class="mono">{coin.balance}</span>
	</div>
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
	.asset-balance {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-grow: 1;
		.img-label {
			display: flex;
			align-items: center;
			gap: 0.5rem;
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
