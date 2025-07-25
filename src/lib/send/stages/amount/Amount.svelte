<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import swapOptions, {
		Coin,
		Network,
		networkMap,
		SendAccount,
		sendAccountOptions,
		type CoinOptions
	} from '$lib/send/sendOptions';
	import { solveNetworkConstraints, SendTxDetails } from '$lib/send/sendUtils';
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import Select from '$lib/zag/Select.svelte';
	import { untrack } from 'svelte';
	import AccountInfo from '../AccountInfo.svelte';
	import AssetInfo from '../AssetInfo.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { CornerDownRight } from '@lucide/svelte';
	import { getIntermediaryNetwork } from '$lib/send/getNetwork';
	import { isValidBalanceField, type BalanceOption } from '$lib/stores/balanceHistory';

	let auth = $authStore;
	let {
		id,
		editStage
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
	} = $props();

	// TODO: change this to give 'to' options not 'from' options
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
		snippetData: CoinOptions['coins'][number];
		snippet: (...args: any[]) => ReturnType<import('svelte').Snippet>;
	}
	const assetObjs: AssetObject[] = $derived(
		assetOptions.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: opt
		}))
	);
	// const fromOptions = $derived(getFromOptions($SendTxDetails.method, auth.value?.did));
	interface AccountObject extends SendAccount {
		snippetData: SendAccount;
		snippet: (...args: any[]) => ReturnType<import('svelte').Snippet>;
	}
	const accountObjs: AccountObject[] = $derived(
		accountOptions.map((opt) => ({
			...opt,
			snippet: accountCard,
			snippetData: opt
		})) ?? []
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

	$effect(() => {
		if (networkOptions.length === 1) {
			if ($SendTxDetails.fromNetwork?.value !== networkOptions[0].value) {
				untrack(() => {
					SendTxDetails.update((current) => ({
						...current,
						fromNetwork: networkOptions[0]
					}));
				});
			}
		} else if ($SendTxDetails.fromNetwork) {
			untrack(() => {
				SendTxDetails.update((current) => ({
					...current,
					fromNetwork: undefined
				}));
			});
		}
	});

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
						getFee()
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
	let effectToAmount = $state('');
	let effectFromAmount = $state('');

	$effect(() => {
		if (effectToAmount === toAmount) return;
		untrack(() => {
			if (!$SendTxDetails.toCoin || !$SendTxDetails.fromCoin) return;
			new CoinAmount(toAmount, $SendTxDetails.toCoin.coin)
				.convertTo($SendTxDetails.fromCoin.coin, Network.lightning)
				.then((amount) => {
					const amtString = amount.toAmountString();
					if (amtString !== fromSwapAmount) {
						effectFromAmount = amtString;
						fromSwapAmount = amtString;
					}
				});
		});
	});

	$effect(() => {
		if (effectFromAmount === fromSwapAmount) return;
		untrack(() => {
			if (!$SendTxDetails.toCoin || !$SendTxDetails.fromCoin) return;
			new CoinAmount(fromSwapAmount, $SendTxDetails.fromCoin.coin)
				.convertTo($SendTxDetails.toCoin.coin, Network.lightning)
				.then((amount) => {
					const amtString = amount.toAmountString();
					if (amtString !== toAmount) {
						effectToAmount = amtString;
						toAmount = amtString;
					}
				});
		});
	});

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
							getFee()
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
			$SendTxDetails.fromAmount !== '0' &&
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
	async function getFee() {
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.fromNetwork &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.toCoin.coin.value !== coins.usd.value &&
			$SendTxDetails.toNetwork
		) {
			const fee = await getIntermediaryNetwork(
				{ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork },
				{ coin: $SendTxDetails.toCoin.coin, network: $SendTxDetails.toNetwork }
			).feeCalculation(
				new CoinAmount(Number(toAmount), $SendTxDetails.toCoin.coin),
				$SendTxDetails.fromCoin.coin
			);
			return fee;
		}
	}
</script>

{#snippet assetCard(fromCoin: CoinOptions['coins'][number] | undefined)}
	<div class="card-wrapper">
		{#if fromCoin}
			<AssetInfo coinOpt={fromCoin} />
		{/if}
	</div>
{/snippet}

{#snippet accountCard(account: SendAccount | undefined)}
	<div class="card-wrapper">
		{#if account}
			<AccountInfo {account} currentCoin={$SendTxDetails.fromCoin?.coin} />
		{/if}
	</div>
{/snippet}

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<div class="wrapper">
	<h2>Amount</h2>
	<h3>Recipient Gets</h3>
	<BasicAmountInput
		bind:amount={toAmount}
		coin={$SendTxDetails.toCoin}
		network={$SendTxDetails.toNetwork}
		id={'basic-input'}
		{maxField}
	/>

	<h3>Asset</h3>
	<Select
		items={assetObjs}
		styleType="card"
		onValueChange={(v) => {
			SendTxDetails.update((current) => ({
				...current,
				toCoin: swapOptions.from.coins.find((val) => val.coin.value === v.value[0])
			}));
		}}
	/>

	<h3>Send From</h3>
	<Select
		items={accountObjs}
		styleType="card"
		onValueChange={(v) => {
			$SendTxDetails.account = sendAccountOptions.find((acc) => acc.value === v.value[0]);
		}}
	/>

	{#if toSelf}
		<p class="error to-self-error">
			Cannot transfer currency to yourself on the same network. Please select a different recipient
			or network.
		</p>
	{/if}

	{#if isSwap}
		<div class="swap-wrapper">
			<CornerDownRight />
			<div class="swap-options">
				<h3>Swap Options</h3>
				<span class="sm-caption">From Asset</span>
				<div class="amt-and-fees">
					<div class="to-amount">
						<BasicAmountInput
							bind:amount={fromSwapAmount}
							coin={$SendTxDetails.fromCoin}
							network={$SendTxDetails.fromNetwork}
							id={'from-amt'}
						/>
					</div>
					{#if $SendTxDetails.fee}
						{@const fee = $SendTxDetails.fee}
						<table>
							<tbody>
								<tr>
									<th>Fee:</th>
									<td>~{fee.toPrettyString()}</td>
								</tr>
								<tr>
									<th>Send Total:</th>
									<td
										>~{fee
											.add(new CoinAmount($SendTxDetails.fromAmount, $SendTxDetails.fromCoin!.coin))
											.toPrettyString()}</td
									>
								</tr>
							</tbody>
						</table>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if $SendTxDetails.fromNetwork}
		<div class="from-network">
			<span class="sm-caption">Sending From Network:</span>
			<div class="network-details">
				<img src={$SendTxDetails.fromNetwork.icon} alt={$SendTxDetails.fromNetwork.label} />
				{$SendTxDetails.fromNetwork.label}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.wrapper {
		min-height: 75vh;
		overflow-y: auto;
		overflow-x: hidden;
		:global(button) {
			color: var(--neutral-fg);
		}
	}
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
	.sm-caption {
		color: var(--neutral-mid);
		font-size: var(--text-sm);
	}
	.from-network {
		margin-top: 2rem;
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
	.swap-wrapper {
		display: flex;
		margin-top: 1rem;
		width: 100%;
		.swap-options {
			.amt-and-fees {
				display: flex;
				justify-content: space-between;
			}
			padding-left: 1rem;
			width: 100%;
			h3 {
				margin-top: 0;
			}
			display: flex;
			flex-direction: column;
			.sm-caption {
				padding-bottom: 0.5rem;
			}
			.to-amount {
				max-width: 50%;
				flex-grow: 1;
			}
			// .coin-select {
			// 	width: fit-content;
			// }
			td {
				display: block;
				font-family: 'Noto Sans Mono Variable', monospace;
				font-weight: 400;
				white-space: nowrap;
				text-align: right;
				padding-left: 0.5rem;
			}
			th {
				flex-grow: 1;
				display: block;
				font-weight: bold;
				text-align: right;
				padding-right: 0.25rem;
			}
			tr {
				padding: 0.25rem 0;
				display: flex;
				align-items: center;
			}
		}
	}

	.to-self-error {
		margin-top: 0.5rem;
	}
</style>
