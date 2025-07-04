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
		type CoinOptionParam
	} from '$lib/send/sendUtils';
	import Select from '$lib/zag/Select.svelte';
	import { untrack } from 'svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { getIntermediaryNetwork } from '$lib/send/getNetwork';
	import { isValidBalanceField, type BalanceOption } from '$lib/stores/balanceHistory';
	import SwapOptions from './SwapOptions.svelte';
	import { accountCard, assetCard, networkCard } from './CardSnippets.svelte';

	let auth = $authStore;
	let {
		id,
		editStage
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
	} = $props();

	const { assetOptions, accountOptions, networkOptions } = $derived(
		solveNetworkConstraints(
			$SendTxDetails.method,
			$SendTxDetails.fromCoin,
			$SendTxDetails.toNetwork,
			auth.value?.did,
			$SendTxDetails.account
		)
	);

	interface AssetObject extends Coin {
		snippetData: { fromOpt: CoinOptionParam | undefined; net?: Network };
		snippet: typeof assetCard;
		disabled?: boolean;
		disabledMemo?: string;
	}
	const assetObjs: AssetObject[] = $derived(
		assetOptions.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.fromNetwork },
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
		snippetData: NetworkOptionParam;
		snippet: typeof networkCard;
	}
	let networkObjs: NetworkObject[] = $derived(
		networkOptions.map((opt) => ({
			...opt,
			snippet: networkCard,
			snippetData: opt
		}))
	);

	let isSwap = $derived($SendTxDetails.account?.value === SendAccount.swap.value);

	// default to USD
	$effect(() => {
		if (isSwap && !$SendTxDetails.toCoin) {
			SendTxDetails.update((current) => ({
				...current,
				toCoin: {
					coin: coins.usd,
					networks: []
				}
			}));
		}
	});

	// TODO: add solution for selecting when there are more possibilities
	// $effect(() => {
	// 	if (networkOptions.length === 1) {
	// 		if ($SendTxDetails.fromNetwork?.value !== networkOptions[0].value) {
	// 			untrack(() => {
	// 				SendTxDetails.update((current) => ({
	// 					...current,
	// 					fromNetwork: networkOptions[0]
	// 				}));
	// 			});
	// 		}
	// 	} else if ($SendTxDetails.fromNetwork) {
	// 		untrack(() => {
	// 			SendTxDetails.update((current) => ({
	// 				...current,
	// 				fromNetwork: undefined
	// 			}));
	// 		});
	// 	}
	// });

	let fromCoinValue = $state('');
	$effect(() => {
		if (isSwap && fromCoinValue) {
			if ($SendTxDetails.fromCoin?.coin.value !== fromCoinValue) {
				const fromCoinOpt = swapOptions.from.coins.find(
					(coin) => coin.coin.value === fromCoinValue
				);
				if (!fromCoinOpt) return;
				if ($SendTxDetails.toCoin) {
					Promise.all([
						new CoinAmount(toAmount, $SendTxDetails.toCoin!.coin).convertTo(
							fromCoinOpt.coin,
							Network.lightning
						),
						getFee(toAmount)
					]).then(([amount, fee]) => {
						SendTxDetails.update((current) => ({
							...current,
							fromCoin: fromCoinOpt,
							fromAmount: amount.toAmountString(),
							fee: fee
						}));
					});
				} else {
					SendTxDetails.update((current) => ({
						...current,
						fromCoin: fromCoinOpt
					}));
				}
			}
		} else if ($SendTxDetails.toCoin?.coin.value !== $SendTxDetails.fromCoin?.coin.value) {
			SendTxDetails.update((current) => ({
				...current,
				fromCoin: current.toCoin,
				fromAmount: current.toAmount
			}));
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
							SendTxDetails.update((current) => ({
								...current,
								toAmount: toAmount,
								fromAmount: amount.toAmountString(),
								fee: fee
							}));
						});
						return;
					}
				}
				SendTxDetails.update((current) => ({
					...current,
					fromAmount: toAmount,
					toAmount: toAmount
				}));
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
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<h2>Amount</h2>
<h3>Recipient Gets</h3>
<BasicAmountInput
	bind:amount={toAmount}
	coin={$SendTxDetails.toCoin}
	network={$SendTxDetails.toNetwork}
	id={'basic-input'}
	{maxField}
	connectedCoinAmount={$SendTxDetails.fromCoin && isSwap
		? new CoinAmount(fromSwapAmount, $SendTxDetails.fromCoin.coin)
		: undefined}
/>

<h3>Asset</h3>
<Select
	items={assetObjs}
	styleType="dropdown"
	onValueChange={(v) => {
		SendTxDetails.update((current) => ({
			...current,
			toCoin: swapOptions.from.coins.find((val) => val.coin.value === v.value[0])
		}));
	}}
/>

<!-- <h3>Send From</h3> -->
<!-- <Select
	items={accountObjs}
	styleType="dropdown"
	onValueChange={(v) => {
		SendTxDetails.update((current) => ({
			...current,
			account: Object.values(SendAccount).find((acc) => acc.value === v.value[0])
		}));
	}}
/> -->
<h3>Origin Network</h3>
<Select
	items={networkObjs}
	styleType="dropdown"
	placeholder="On Network"
	initial={$SendTxDetails.fromNetwork?.value}
	onValueChange={(v) => {
		SendTxDetails.update((current) => ({
			...current,
			fromNetwork: Object.values(Network).find((net) => net.value === v.value[0])
		}));
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

<!-- {#if $SendTxDetails.fromNetwork}
	<div class="from-network">
		<span class="sm-caption">Sending From Network:</span>
		<div class="network-details">
			<img src={$SendTxDetails.fromNetwork.icon} alt={$SendTxDetails.fromNetwork.label} />
			{$SendTxDetails.fromNetwork.label}
		</div>
	</div>
{/if} -->

<style lang="scss">
	// .card-wrapper {
	// 	color: var(--neutral-fg);
	// }
	h3 {
		margin-top: 2rem;
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
	// .from-network {
	// 	margin-top: 2rem;
	// 	display: flex;
	// 	flex-direction: column;
	// 	gap: 0.5rem;
	// 	.network-details {
	// 		img {
	// 			width: 2rem;
	// 		}
	// 		display: flex;
	// 		align-items: center;
	// 		gap: 0.5rem;
	// 	}
	// }

	.to-self-error {
		margin-top: 0.5rem;
	}
</style>
