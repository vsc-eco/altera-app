<script lang="ts">
	import {
		getFee,
		getLastPaidContact,
		getLastPaidNetwork,
		getRecipientNetworks,
		SendTxDetails,
		solveNetworkConstraints
	} from '../sendUtils';
	import ContactInfo from '../stages/ContactInfo.svelte';
	import { authStore } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromAuth } from '$lib/getAccountName';
	import { vscTxsStore, waitForExtend } from '$lib/stores/txStores';
	import moment from 'moment';
	import { CircleUser } from '@lucide/svelte';
	import SelectContact from '../stages/recipient/SelectContact.svelte';
	import Card from '$lib/cards/Card.svelte';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { isValidBalanceField, type BalanceOption } from '$lib/stores/balanceHistory';
	import swapOptions, {
		Coin,
		Network,
		networkMap,
		SendAccount,
		type CoinOptions
	} from '../sendOptions';
	import Select from '$lib/zag/Select.svelte';
	import NetworkInfo from '../stages/NetworkInfo.svelte';
	import { accountCard, assetCard } from '../stages/amount/CardSnippets.svelte';
	import SwapOptions from '../stages/amount/SwapOptions.svelte';
	import { untrack } from 'svelte';

	let {
		id,
		editStage
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
	} = $props();
	const auth = $authStore;
	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));
	let isSwap = $derived($SendTxDetails.account?.value === SendAccount.swap.value);

	// EDIT STAGE
	let toSelf = $derived(
		$SendTxDetails.toUsername === getUsernameFromAuth(auth) &&
			$SendTxDetails.fromNetwork?.value === $SendTxDetails.toNetwork?.value
	);
	$effect(() => {
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.fromNetwork &&
            $SendTxDetails.toAmount &&
			$SendTxDetails.toAmount !== '0' &&
			!toSelf &&
			$SendTxDetails.toUsername &&
			$SendTxDetails.toNetwork
		) {
			editStage(id, true);
		} else {
			editStage(id, false);
		}
	});

	// AMOUNT SECTION
	let toAmount = $state('');
	let fromSwapAmount = $state('');

	const maxField: BalanceOption | undefined = $derived.by(() => {
		if (isSwap || $SendTxDetails.fromNetwork?.value !== Network.vsc.value) return;
		const fromCoin = $SendTxDetails.fromCoin?.coin;
		if (!fromCoin) return undefined;
		if (isValidBalanceField(fromCoin.value)) {
			return fromCoin.value as BalanceOption;
		}
	});

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

	// ACCOUNT SECTION
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
		snippet: typeof assetCard;
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
		snippet: typeof accountCard;
	}
	const accountObjs: AccountObject[] = $derived(
		accountOptions.map((opt) => ({
			...opt,
			snippet: accountCard,
			snippetData: opt
		})) ?? []
	);
	let fromCoinOptions = $derived(
		$SendTxDetails.fromNetwork
			? (networkMap.get($SendTxDetails.fromNetwork.value)?.map((coin) => ({
					icon: coin.icon,
					value: coin.value,
					label: coin.label
				})) ?? [])
			: []
	);

	$inspect($SendTxDetails);

	let fromCoinValue = $state('');
	// TODO: replace with logic for multiple coin options
	// either a radio group or dropdown on the amount
	$effect(() => {
		if (fromCoinOptions.length === 1) {
			fromCoinValue = fromCoinOptions[0].value;
		}
	});

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

	// RECIPIENT SECTION
	let lastPaid = $state('Never');
	$effect(() => {
		if (!auth.value) return;
		getLastPaidContact(auth, toDid).then((paid) => (lastPaid = paid));
	});
	let contactOpen = $state(false);

	const availableNetworks = $derived(
		getRecipientNetworks(getDidFromUsername($SendTxDetails.toUsername))
	);
	let networkItems = $derived(
		availableNetworks.map((v) => {
			return {
				icon: v.icon,
				value: v.value,
				label: v.label,
				snippet: networkCard,
				snippetData: v
			};
		})
	);
</script>

{#snippet selectContact()}
	<SelectContact close={() => (contactOpen = false)} />
{/snippet}

{#snippet networkCard(net: Network)}
	{#await getLastPaidNetwork(auth, net.value) then lastPaid}
		<NetworkInfo network={net} {lastPaid} adjacent={true} />
	{/await}
{/snippet}

{#if contactOpen}
	{@render selectContact()}
{:else}
	<h2>Send</h2>
	<div class="section">
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
	</div>

	<div class="section">
		<Select
			items={assetObjs}
			styleType="card"
			placeholder="Asset"
			onValueChange={(v) => {
				SendTxDetails.update((current) => ({
					...current,
					toCoin: swapOptions.from.coins.find((val) => val.coin.value === v.value[0])
				}));
			}}
		/>

		<div class="account-select">
			<Select
				items={accountObjs}
				styleType="card"
				placeholder="Account"
				onValueChange={(v) => {
					SendTxDetails.update((current) => ({
						...current,
						account: Object.values(SendAccount).find((acc) => acc.value === v.value[0])
					}));
				}}
			/>

			{#if isSwap}
				<SwapOptions bind:toAmount bind:fromSwapAmount />
			{/if}
			{#if toSelf}
				<p class="error to-self-error">
					Cannot transfer currency to yourself on the same network. Please select a different
					recipient or network.
				</p>
			{/if}
		</div>
	</div>

	<div class="section">
		<h3>To</h3>
		<Card>
			<div class="name-card">
				{#if $SendTxDetails.toUsername}
					<ContactInfo
						did={toDid}
						name={$SendTxDetails.toDisplayName}
						accounts={[$SendTxDetails.toUsername]}
						{lastPaid}
					/>
				{:else}
					<span class="user-icon-placeholder"><CircleUser /></span>
				{/if}
				<span class="more">
					<button onclick={() => (contactOpen = true)} class="small-button"> Edit </button>
				</span>
			</div>
		</Card>

		<Select
			items={networkItems}
			initial={$SendTxDetails.toNetwork?.value}
			styleType="card"
			placeholder="Recipient Network"
			onValueChange={(v) => {
				SendTxDetails.update((current) => ({
					...current,
					toNetwork: Object.values(Network).find((net) => net.value === v.value[0])
				}));
			}}
		/>
	</div>
{/if}

<style lang="scss">
	.name-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		.more {
			margin-left: auto;
		}
	}
	.small-button {
		border: none;
		background-color: transparent;
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--accent-fg-mid);
	}
	.section {
        padding-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	h3 {
		margin-top: 1rem;
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
	.account-select {
		p {
			margin-top: 0.25rem;
		}
	}
</style>
