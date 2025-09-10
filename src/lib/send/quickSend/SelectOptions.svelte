<script lang="ts">
	import {
		momentToLastPaidString,
		getFee,
		getLastPaidContact,
		getRecipientNetworks,
		SendTxDetails,
		solveNetworkConstraints,
		type CoinOptionParam,
		type NetworkOptionParam
	} from '../sendUtils';
	import { getAuth } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromAuth } from '$lib/getAccountName';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { isValidBalanceField, type BalanceOption } from '$lib/stores/balanceHistory';
	import swapOptions, { Coin, Network, networkMap, SendAccount } from '../sendOptions';
	import Select from '$lib/zag/Select.svelte';
	import { assetCard, networkCard } from '../stages/components/SendSnippets.svelte';
	import SwapOptions from '../stages/amount/SwapOptions.svelte';
	import { untrack } from 'svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import RecipientCard from '../stages/recipient/RecipientCard.svelte';
	import ContactSearchBox from '../stages/recipient/search/ContactSearchBox.svelte';
	import SelectContact from '../contacts/SelectContact.svelte';
	import type { Contact } from '../contacts/contacts';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		id,
		hideNav = $bindable(),
		editStage
	}: {
		id: string;
		hideNav: boolean;
		editStage: (id: string, add: boolean) => void;
	} = $props();
	const auth = $derived(getAuth()());
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
	let lastFromCoin = $state($SendTxDetails.fromCoin?.coin);
	$effect(() => {
		const newFromCoin = $SendTxDetails.fromCoin?.coin;
		if (newFromCoin?.value === lastFromCoin?.value) return;
		untrack(() => {
			if (!newFromCoin) return;
			const amountAvailable =
				$SendTxDetails.fromCoin && isValidBalanceField(newFromCoin.value)
					? $accountBalance.bal[newFromCoin.value]
					: undefined;
			if (
				amountAvailable === 0 &&
				$SendTxDetails.fromNetwork?.value === Network.vsc.value &&
				networkOptions.find((net) => net.value === Network.hiveMainnet.value)?.disabled === false
			) {
				$SendTxDetails.fromNetwork = Network.hiveMainnet;
			}
		});
		lastFromCoin = newFromCoin;
	});

	const maxField: BalanceOption | undefined = $derived.by(() => {
		if (isSwap || $SendTxDetails.fromNetwork?.value !== Network.vsc.value) return;
		const fromCoin = $SendTxDetails.fromCoin?.coin;
		if (!fromCoin) return undefined;
		if (isValidBalanceField(fromCoin.value)) {
			return fromCoin.value as BalanceOption;
		}
	});

	// default to USD if swap
	$effect(() => {
		if (isSwap && !$SendTxDetails.toCoin) {
			$SendTxDetails.toCoin = {
				coin: coins.usd,
				networks: []
			};
		}
	});

	// ACCOUNT SECTION
	const { assetOptions, accountOptions, networkOptions } = $derived(
		solveNetworkConstraints(
			$SendTxDetails.method,
			$SendTxDetails.fromCoin,
			$SendTxDetails.toNetwork,
			auth.value?.did,
			$SendTxDetails.account,
			$SendTxDetails.fromNetwork
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
	// interface AccountObject extends AccountOptionParam {
	// 	snippetData: AccountOptionParam;
	// 	snippet: typeof accountCard;
	// }
	// const accountObjs: AccountObject[] = $derived(
	// 	accountOptions.map((opt) => ({
	// 		...opt,
	// 		snippet: accountCard,
	// 		snippetData: opt
	// 	})) ?? []
	// );
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
	let fromCoinOptions = $derived(
		$SendTxDetails.fromNetwork
			? (networkMap.get($SendTxDetails.fromNetwork.value)?.map((coin) => ({
					icon: coin.icon,
					value: coin.value,
					label: coin.label
				})) ?? [])
			: []
	);

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

	// Reinstate if using account instead of direct network
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

	// RECIPIENT SECTION
	let isValidHive = $state(false);
	let lastPaid = $state('Never');
	$effect(() => {
		if (!auth.value) return;
		getLastPaidContact(toDid).then((paid) => (lastPaid = momentToLastPaidString(paid)));
	});
	let contactOpen = $state(false);
	$effect(() => {
		hideNav = contactOpen;
	});

	const availableNetworks = $derived(
		getRecipientNetworks(getDidFromUsername($SendTxDetails.toUsername))
	);
	let networkItems = $derived(
		availableNetworks.map((v) => {
			return {
				icon: v.icon,
				value: v.value,
				label: v.label,
				disabled: v.disabled,
				snippet: networkCard,
				snippetData: { net: v, hideDetails: true }
			};
		})
	);
	// MEMO SECTION
	let memo = $state('');

	let warningMsg = $derived(
		getDidFromUsername($SendTxDetails.toUsername).startsWith('hive:') && !isValidHive
			? 'Warning: This hive account does not exist. Payment to this address may result in loss of funds.'
			: undefined
	);

	let contact = $state<Contact>();
	let toggleContact = (open = false) => {
		contactOpen = open;
	};
	let createNew: string | undefined = $derived(
		!contact && $SendTxDetails.toUsername ? $SendTxDetails.toUsername : undefined
	);
	let openToCreate = $state(false);
	function openContact(create = false) {
		openToCreate = create;
		toggleContact(true);
	}
</script>

{#if contactOpen}
	<div class="contact-external-wrapper">
		<div class="back-button">
			<PillButton onclick={() => toggleContact()} styleType="icon-subtle">
				<ArrowLeft size="32" />
			</PillButton>
		</div>
		<SelectContact
			bind:selectedContact={contact}
			editing={openToCreate}
			close={() => (contactOpen = false)}
			{createNew}
		/>
	</div>
{:else}
	<h2>Send</h2>
	<div class="section to">
		<span class="sm-caption nogap">To</span>
		<ContactSearchBox
			bind:value={$SendTxDetails.toUsername}
			bind:selectedContact={contact}
			enableContacts={false}
			placeholder="Enter address"
		/>
		<RecipientCard basic edit={openContact} {contact} />
		<!-- <div class="selected">
			<input
				id="send-recipient"
				bind:value={recipientUsername}
				placeholder="Find a contact or paste wallet address"
			/>
		</div> -->

		<span class="sm-caption gap">Recipient Network</span>
		<Select
			items={networkItems}
			initial={$SendTxDetails.toNetwork?.value}
			styleType="dropdown"
			placeholder="Recipient Network"
			onValueChange={(v) => {
				$SendTxDetails.toNetwork = Object.values(Network).find((net) => net.value === v.value[0]);
			}}
		/>
	</div>

	<div class="section from">
		<span class="sm-caption nogap">Asset</span>
		<Select
			items={assetObjs}
			styleType="dropdown"
			placeholder="Token"
			onValueChange={(v) => {
				$SendTxDetails.toCoin = swapOptions.from.coins.find((val) => val.coin.value === v.value[0]);
			}}
		/>

		<span class="sm-caption gap">Origin Network</span>
		<div class="from-network-select">
			<!-- <Select
				items={accountObjs}
				styleType="dropdown"
				placeholder="Account"
				onValueChange={(v) => {
					SendTxDetails.update((current) => ({
						...current,
						account: Object.values(SendAccount).find((acc) => acc.value === v.value[0])
					}));
				}}
			/> -->
			<Select
				items={networkObjs}
				styleType="dropdown"
				placeholder="On Network"
				initial={$SendTxDetails.fromNetwork?.value}
				onValueChange={(v) => {
					$SendTxDetails.fromNetwork = Object.values(Network).find(
						(net) => net.value === v.value[0]
					);
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
		<span class="sm-caption">Amount</span>
		<AmountInput
			bind:amount={toAmount}
			coin={$SendTxDetails.toCoin}
			network={$SendTxDetails.toNetwork ?? $SendTxDetails.fromNetwork}
			{maxField}
			connectedCoinAmount={$SendTxDetails.fromCoin && isSwap
				? new CoinAmount(fromSwapAmount, $SendTxDetails.fromCoin.coin)
				: undefined}
		/>
	</div>

	<div class="section">
		<span class="sm-caption">Memo (optional)</span>
		<input
			bind:value={memo}
			maxlength="300"
			onchange={() => {
				$SendTxDetails.memo = memo;
			}}
		/>
	</div>
{/if}

<style lang="scss">
	.section {
		padding: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		&.from {
			border-top: 1px solid var(--neutral-bg-accent-shifted);
			padding-top: 2rem;
		}
		&.to {
			padding-bottom: 2rem;
		}
	}
	.sm-caption {
		&.gap {
			padding-top: 1rem;
		}
	}

	.contact-external-wrapper:not(:has(:global(.dialog-list-header))) {
		.back-button {
			display: none;
		}
	}
</style>
