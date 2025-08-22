<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import swapOptions, {
		Coin,
		Network,
		networkMap,
		SendAccount,
		type CoinOptions
	} from '$lib/send/sendOptions';
	import {
		solveNetworkConstraints,
		SendTxDetails,
		getFee,
		type NetworkOptionParam,
		type CoinOptionParam,
		getRecipientNetworks,
		type AccountOptionParam
	} from '$lib/send/sendUtils';
	import Select from '$lib/zag/Select.svelte';
	import { untrack } from 'svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getDidFromUsername, getUsernameFromAuth } from '$lib/getAccountName';
	import { getIntermediaryNetwork } from '$lib/send/getNetwork';
	import { isValidBalanceField, type BalanceOption } from '$lib/stores/balanceHistory';
	import SwapOptions from './SwapOptions.svelte';
	import {
		accountCard,
		assetCard,
		networkCard,
		type AssetObject
	} from '../components/CardSnippets.svelte';
	import Card from '$lib/cards/Card.svelte';
	import NetworkInfo from '../components/NetworkInfo.svelte';
	import { Coins, Landmark, Link, Link2 } from '@lucide/svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import SelectAsset from './SelectAsset.svelte';
	import AssetInfo from '../components/AssetInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import EditButton from '$lib/components/EditButton.svelte';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';

	let auth = $authStore;
	let {
		id,
		editStage
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
	} = $props();

	function optionsEqual<T>(
		a: (CoinOptionParam | AccountOptionParam | NetworkOptionParam)[],
		b: (CoinOptionParam | AccountOptionParam | NetworkOptionParam)[]
	): boolean {
		if (a.length !== b.length) return false;

		const getValue = (item: CoinOptionParam | AccountOptionParam | NetworkOptionParam) =>
			'coin' in item ? item.coin.value : item.value;

		return a.every(
			(val, i) =>
				getValue(val) === getValue(b[i]) &&
				val.disabled === b[i].disabled &&
				val.disabledMemo === b[i].disabledMemo
		);
	}

	let { assetOptions, accountOptions, networkOptions } = $state<
		ReturnType<typeof solveNetworkConstraints>
	>({ assetOptions: [], accountOptions: [], networkOptions: [] });
	$effect(() => {
		const {
			assetOptions: newAssetOptions,
			accountOptions: newAccountOptions,
			networkOptions: newNetworkOptions
		} = solveNetworkConstraints(
			$SendTxDetails.method,
			$SendTxDetails.fromCoin,
			$SendTxDetails.toNetwork,
			auth.value?.did,
			$SendTxDetails.account,
			$SendTxDetails.fromNetwork,
			true
		);
		if (!optionsEqual(newAssetOptions, assetOptions)) {
			assetOptions = newAssetOptions;
		}
		if (!optionsEqual(newAccountOptions, accountOptions)) {
			accountOptions = newAccountOptions;
		}
		if (!optionsEqual(newNetworkOptions, networkOptions)) {
			networkOptions = newNetworkOptions;
		}
	});

	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));

	const assetObjs: AssetObject[] = $derived(
		assetOptions.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.fromNetwork, size: 'medium' },
			disabled: opt.disabled,
			disabledMemo: opt.disabledMemo
		}))
	);
	// const fromOptions = $derived(getFromOptions($SendTxDetails.method, auth.value?.did));
	interface AccountObject extends SendAccount {
		snippetData: SendAccount;
		snippet: typeof accountCard;
	}
	const accountObjs: AccountObject[] = $derived(
		accountOptions.map((opt) => ({
			...opt,
			snippet: accountCard,
			snippetData: opt
		})) ?? []
	);
	interface NetworkObject extends NetworkOptionParam {
		snippetData: typeof networkCard.arguments;
		snippet: typeof networkCard;
	}
	let networkObjs: NetworkObject[] = $derived(
		networkOptions.map((opt) => ({
			...opt,
			snippet: networkCard,
			snippetData: { net: opt }
		}))
	);

	let isSwap = $derived($SendTxDetails.account?.value === SendAccount.swap.value);

	// default to USD
	$effect(() => {
		if (isSwap && !$SendTxDetails.toCoin) {
			$SendTxDetails.toCoin = {
				coin: coins.usd,
				networks: []
			};
		}
	});

	let fromCoinValue = $state('');
	$effect(() => {
		const newNet = $SendTxDetails.fromNetwork;
		if (!newNet) return;
		untrack(() => {
			const currentCoinNetworks = $SendTxDetails.toCoin?.networks;
			if (!currentCoinNetworks) return;
			if (currentCoinNetworks.some((net) => net.value === newNet?.value)) return;
			if ($SendTxDetails.toCoin) {
				// console.log($SendTxDetails.fromNetwork, $SendTxDetails.toCoin);
				$SendTxDetails.toCoin = undefined;
			}
		});
	});
	$effect(() => {
		if (isSwap && fromCoinValue) {
			if ($SendTxDetails.fromCoin?.coin.value !== fromCoinValue) {
				const fromCoinOpt = swapOptions.from.coins.find(
					(coin) => coin.coin.value === fromCoinValue
				);
				if (!fromCoinOpt) return;
				$SendTxDetails.fromCoin = fromCoinOpt;
				if ($SendTxDetails.toCoin) {
					Promise.all([
						new CoinAmount(toAmount, $SendTxDetails.toCoin!.coin).convertTo(
							fromCoinOpt.coin,
							Network.lightning
						),
						getFee(toAmount)
					]).then(([amount, fee]) => {
						$SendTxDetails.fromAmount = amount.toAmountString();
						$SendTxDetails.fee = fee;
					});
				}
			}
		} else if ($SendTxDetails.toCoin?.coin.value !== $SendTxDetails.fromCoin?.coin.value) {
			$SendTxDetails.fromCoin = $SendTxDetails.toCoin;
			$SendTxDetails.fromAmount = $SendTxDetails.toAmount;
		}
	});

	let fromCoinOptions = $derived(
		$SendTxDetails.fromNetwork
			? (networkMap.get($SendTxDetails.fromNetwork.value)?.map((coin) => ({
					icon: coin.icon,
					value: coin.value,
					label: coin.label,
					snippet: radioLabel
				})) ?? [])
			: []
	);

	// TODO: replace with logic for multiple coin options
	// either a radio group or dropdown on the amount
	$effect(() => {
		if (fromCoinOptions.length === 1) {
			fromCoinValue = fromCoinOptions[0].value;
		}
	});

	const maxField: BalanceOption | undefined = $derived.by(() => {
		if (isSwap || $SendTxDetails.fromNetwork?.value !== Network.vsc.value) return;
		const fromCoin = $SendTxDetails.fromCoin?.coin;
		if (!fromCoin) return undefined;
		if (isValidBalanceField(fromCoin.value)) {
			return fromCoin.value as BalanceOption;
		}
	});

	let toAmount = $state('');
	let fromSwapAmount = $state('');
	let inUsd = $state('');

	$effect(() => {
		if (toAmount !== $SendTxDetails.toAmount) {
			untrack(() => {
				if ($SendTxDetails.toCoin && $SendTxDetails.toCoin !== $SendTxDetails.fromCoin) {
					const fromCoin = swapOptions.from.coins.find((coin) => coin.coin.value === fromCoinValue);
					if (fromCoin && $SendTxDetails.fromCoin) {
						Promise.all([
							new CoinAmount(toAmount, $SendTxDetails.toCoin!.coin).convertTo(
								fromCoin.coin,
								Network.lightning
							),
							getFee(toAmount)
						]).then(([amount, fee]) => {
							$SendTxDetails.toAmount = toAmount;
							$SendTxDetails.fromAmount = amount.toAmountString();
							$SendTxDetails.fee = fee;
						});
						return;
					}
				}
				$SendTxDetails.fromAmount = $SendTxDetails.toAmount = toAmount;
			});
		}
	});

	$effect(() => {
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.fromNetwork &&
			$SendTxDetails.toAmount &&
			$SendTxDetails.toAmount !== '0' &&
			!toSelf
		) {
			editStage(id, true);
		} else {
			editStage(id, false);
		}
	});
	let toSelf = $derived(
		$SendTxDetails.toUsername === getUsernameFromAuth(auth) &&
			$SendTxDetails.fromNetwork?.value === $SendTxDetails.toNetwork?.value
	);

	let lastAsset = $state('Never');
	let assetOpen = $state(false);
	let toggleAsset = $state<(open?: boolean) => void>(() => {});

	// DETAILS
	let memo = $state('');

	// $inspect(assetOptions);
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<h2>Amount</h2>
<h3>Recipient Gets</h3>
<!-- if swap integrate this with basic amt again
 connectedCoinAmount={$SendTxDetails.fromCoin && isSwap
			? new CoinAmount(fromSwapAmount, $SendTxDetails.fromCoin.coin)
			: undefined}
-->
<div class="amounts">
	<BasicAmountInput
		bind:amount={toAmount}
		coin={$SendTxDetails.toCoin}
		network={$SendTxDetails.toNetwork}
		id={'basic-input'}
		{maxField}
		connectedCoinAmount={new CoinAmount(inUsd, coins.usd)}
	/>
	{#if $SendTxDetails.toCoin && $SendTxDetails.toCoin?.coin.value !== coins.usd.value}
		<Link2 />
		<BasicAmountInput
			bind:amount={inUsd}
			coin={{
				coin: coins.usd,
				networks: []
			}}
			network={undefined}
			id="usd-input"
			connectedCoinAmount={$SendTxDetails.toCoin
				? new CoinAmount(toAmount, $SendTxDetails.toCoin.coin)
				: undefined}
		/>
	{/if}
</div>

<h3>Asset</h3>
<ClickableCard onclick={() => toggleAsset(true)}>
	<div class="asset-card">
		{#if $SendTxDetails.fromCoin}
			<AssetInfo coinOpt={$SendTxDetails.fromCoin} size="medium" />
		{:else}
			<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
		{/if}
		<!-- {#if getRecipientNetworks(toDid).length > 1} -->
		<span class="more">
			<EditButton onclick={() => toggleAsset(true)} />
		</span>
		<!-- {/if} -->
	</div>
</ClickableCard>
<Dialog bind:open={assetOpen} bind:toggle={toggleAsset}>
	{#snippet content()}
		<SelectAsset availableCoins={assetObjs} close={toggleAsset} />
	{/snippet}
</Dialog>

<h3>Origin Network</h3>
<Select
	items={networkObjs}
	styleType="dropdown"
	placeholder="On Network"
	initial={$SendTxDetails.fromNetwork?.value}
	onValueChange={(v) => {
		if ($SendTxDetails.fromNetwork?.value !== v.value[0]) {
			$SendTxDetails.fromNetwork = Object.values(Network).find((net) => net.value === v.value[0]);
		}
	}}
/>

{#if toSelf}
	<p class="error to-self-error">
		Cannot transfer currency to yourself on the same network. Please select a different recipient or
		network.
	</p>
{/if}

{#if isSwap}
	<SwapOptions bind:toAmount bind:fromSwapAmount />
{/if}

<hr />

<h2 class="details-header">Details</h2>
<div class="details">
	<span class="sm-caption">Memo (optional)</span>
	<input
		bind:value={memo}
		maxlength="300"
		onchange={() => {
			$SendTxDetails.memo = memo;
		}}
	/>
	<span>Custom message to the recipient.</span>
</div>

<style lang="scss">
	h3 {
		margin-top: 2rem;
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
	.amounts {
		display: flex;
		align-items: center;
		gap: 1rem;
		@media screen and (max-width: 450px) {
			flex-direction: column;
			gap: 0.25rem;
			:global(.wrapper) {
				width: 100%;
			}
		}
	}
	.asset-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem;
		.more {
			margin-left: auto;
		}
	}
	.to-self-error {
		margin-top: 0.5rem;
	}
	hr {
		margin: 2rem 0;
		border-color: var(--neutral-bg-accent);
	}
	.details-header {
		font-size: var(--text-3xl);
	}
	.details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		input {
			width: calc(100% - 0.5rem);
		}
	}
</style>
