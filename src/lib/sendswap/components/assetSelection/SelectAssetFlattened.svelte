<script lang="ts">
	import { getFromOption, Coin, Network, type CoinOnNetwork } from '$lib/sendswap/utils/sendOptions';
	import { untrack, type Snippet } from 'svelte';
	import AssetList from './AssetList.svelte';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getAuth } from '$lib/auth/store';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import BalanceInfo from '../info/BalanceInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import { getHiveAssetName, getHbdAssetName } from '../../../../client';

	function assetDisplayLabel(coin: Coin): string {
		return coin.value === Coin.hive.value
			? getHiveAssetName()
			: coin.value === Coin.hbd.value
				? getHbdAssetName()
				: coin.label;
	}

	let {
		availableCoins,
		selected = $bindable(),
		max = $bindable(),
		close,
		externalNetwork,
		isTo = false,
		dialogTitle = 'Select an Asset'
	}: {
		availableCoins: Coin[];
		selected: CoinOnNetwork | undefined;
		max?: CoinAmount<Coin> | undefined;
		close: () => void;
		externalNetwork?: Network;
		isTo?: boolean;
		dialogTitle?: string;
	} = $props();

	const auth = $derived(getAuth()());

	const onMagi = $derived(
		availableCoins.filter(
			(coin) => coin.value in $accountBalance.bal || (isTo && coin.value === Coin.sats.value)
		)
	);

	let showEmptyAccounts = $state(untrack(() => isTo));

	interface BalanceObject extends Coin {
		balance: string;
		onNetwork: Network;
		snippet: (...args: any[]) => ReturnType<Snippet>;
		disabled?: boolean;
	}
	const magiItems: BalanceObject[] = $derived(
		onMagi
			.map((coin) => {
				// REMOVE FOR BITCOIN PROD
				const coinAmt = new CoinAmount(
					$accountBalance.bal[coin.value as keyof AccountBalance] ?? 0,
					coin,
					true
				);
				const disabled = coinAmt.amount === 0 && !isTo;
				if (!disabled || showEmptyAccounts) {
					return {
						...coin,
						label: assetDisplayLabel(coin),
						unit: assetDisplayLabel(coin),
						value: `${coin.value}:${Network.magi.value}`,
						balance: coinAmt.toPrettyAmountString(),
						onNetwork: Network.magi,
						snippet: assetBalance,
						snippetData: undefined,
						disabled: disabled
					};
				}
			})
			.filter((coin) => coin !== undefined)
	);

	let externalItems: BalanceObject[] = $state([]);
	let loading = $state(false);
	let externalTotalLength = $state(0);
	$effect(() => {
		showEmptyAccounts;
		if (!auth || auth.value?.provider !== 'aioha') return;
		if (externalNetwork?.value === Network.hiveMainnet.value) {
			untrack(() => {
				if (!$accountBalance.connectedBal) return;
				loading = true;

				let result: BalanceObject[] = [];

				externalTotalLength = Object.entries($accountBalance.connectedBal).length;

				for (const [coinVal, bal] of Object.entries($accountBalance.connectedBal)) {
					const coin = Object.values(Coin).find((coin) => coin.value === coinVal);
					if (!coin) continue;
					const disabled = bal === 0 && !isTo;
					if (!showEmptyAccounts && disabled) continue;
					result.push({
						...coin,
						label: assetDisplayLabel(coin),
						unit: assetDisplayLabel(coin),
						value: `${coin.value}:${externalNetwork.value}`,
						balance: new CoinAmount(bal, coin, true).toPrettyAmountString(),
						onNetwork: externalNetwork,
						snippet: assetBalance,
						disabled: disabled
					});
				}
				externalItems = result;
				loading = false;
			});
		} else if (externalNetwork?.value === Network.lightning.value) {
			loading = true;
			externalTotalLength = 1;
			externalItems = availableCoins
				.filter((coinOpt) => coinOpt.value === Coin.btc.value)
				.map((assetObj) => ({
					...assetObj,
					value: `${assetObj.value}:${externalNetwork.value}`,
					onNetwork: Network.lightning,
					balance: '',
					snippet: assetBalanceQuiet,
					snippetData: undefined
				}));
			loading = false;
		}
	});

	// REMOVE -1 FOR BITCOIN LAUNCH
	let maxItems = $derived(onMagi.length - 1 + externalTotalLength);

	// $inspect('vscitems', magiItems);
	// $inspect('externalitems', externalItems);

	function handleAssetClick(balanceVal: string) {
		const assetVal = balanceVal.split(':')[0];
		const networkVal = balanceVal.split(':')[1];
		const balanceObj = [...magiItems, ...externalItems].find((item) => item.value === balanceVal);
		const nextAsset = getFromOption(assetVal);
		const nextNetwork =
			[Network.magi, externalNetwork].find((net) => net?.value === networkVal) ?? Network.magi;
		if (!nextAsset) {
			selected = undefined;
			max = undefined;
		} else {
			selected = { coin: nextAsset.coin, network: nextNetwork };
			if (balanceObj && 'balance' in balanceObj) {
				const coinObj: Coin = { ...balanceObj, value: assetVal };
				max = new CoinAmount(balanceObj.balance, coinObj);
			}
		}
		close();
		return;
	}

	$effect(() => {
		if (
			availableCoins.length > 0 &&
			selected &&
			!availableCoins.map((c) => c.value).includes(selected.coin.value)
		) {
			selected = undefined;
		}
	});
</script>

{#snippet assetBalance(coin: BalanceObject)}
	{#if coin.value}
		{@const properCoin: Coin = { ...coin, value: coin.value.split(':')[0] }}
		<BalanceInfo coin={properCoin} network={coin.onNetwork} size="large" />
	{/if}
{/snippet}

{#snippet assetBalanceQuiet(coin: BalanceObject)}
	{#if coin.value}
		{@const properCoin: Coin = { ...coin, value: coin.value.split(':')[0] }}
		<BalanceInfo coin={properCoin} network={coin.onNetwork} size="large" styleType="quiet" />
	{/if}
{/snippet}

<div class="dialog-content">
	<h5>{dialogTitle}</h5>
	{#if loading}
		<div class="assets-loading"><WaveLoading /></div>
	{:else}
		<div class="listbox-wrapper">
			<AssetList
				items={[...magiItems, ...externalItems]}
				value={`${selected?.coin.value}:${selected?.network.value}`}
				clickAsset={handleAssetClick}
				type="balance"
			/>
		</div>
		{#if !isTo && (magiItems.length + externalItems.length < maxItems || showEmptyAccounts)}
			<div class="show-hide-accs">
				<PillButton
					onclick={() => (showEmptyAccounts = !showEmptyAccounts)}
					styleType="text-subtle"
				>
					<span class="edit">
						{#if showEmptyAccounts}
							Hide Empty Accounts
							<ChevronUp size={20} />
						{:else}
							Show Empty Accounts
							<ChevronDown size={20} />
						{/if}
					</span>
				</PillButton>
			</div>
		{/if}
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
	.show-hide-accs {
		margin-left: auto;
		padding-top: 0.25rem;
		.edit {
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
