<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromAuth } from '$lib/getAccountName';
	import { Coins, Link2 } from '@lucide/svelte';
	import { untrack, type ComponentProps, type Snippet } from 'svelte';
	import {
		momentToLastPaidString,
		getLastPaidContact,
		getLastPaidNetwork,
		getRecipientNetworks,
		SendTxDetails,
		getFee,
		solveToNetworks,
		type NetworkOptionParam
	} from '../utils/sendUtils';
	import swapOptions, { Coin, Network, TransferMethod } from '../utils/sendOptions';
	import Dialog from '$lib/zag/Dialog.svelte';
	import SelectContact from '$lib/sendswap/contacts/SelectContact.svelte';
	import RecipientCard from '../components/RecipientCard.svelte';
	import {
		compareContacts,
		getAllLastPaid,
		getContacts,
		processMap,
		setAllContacts,
		type Contact
	} from '$lib/sendswap/contacts/contacts';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import ContactSearchBox from '$lib/sendswap/contacts/ContactSearchBox.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { assetCard, type AssetObject } from '../components/info/SendSnippets.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import EditButton from '$lib/components/EditButton.svelte';
	import TransferBar from '../components/TransferBar.svelte';
	import SelectAssetFlattened from '../components/assetSelection/SelectAssetFlattened.svelte';
	import Select from '$lib/zag/Select.svelte';
	import Divider from '$lib/components/Divider.svelte';
	import BalanceInfo from '../components/info/BalanceInfo.svelte';

	let {
		editStage
	}: {
		editStage: (add: boolean) => void;
	} = $props();

	const auth = $derived(getAuth()());

	$effect(() => {
		if (!auth.value) return;
		untrack(() => {
			const contacts = getContacts();
			processMap<string, Contact, Contact>(contacts, async (contact) => {
				const lastPaidMoment = await getAllLastPaid(contact);
				const lastPaidString = momentToLastPaidString(lastPaidMoment);
				return {
					...contact,
					lastPaid: lastPaidString
				};
			}).then((res) => {
				const unwrapped = new Map<string, Contact>();
				for (const [key, settled] of res) {
					if (settled.status === 'fulfilled') {
						const oldContact = contacts.get(key);
						if (compareContacts(oldContact!, settled.value) < 1) {
							unwrapped.set(key, oldContact!);
						} else {
							unwrapped.set(key, settled.value);
						}
					} else {
						const oldContact = contacts.get(key);
						if (oldContact) {
							unwrapped.set(key, oldContact);
						}
					}
				}
				setAllContacts(unwrapped);
			});
		});
	});

	$effect(() => {
		if (
			$SendTxDetails.toUsername &&
			$SendTxDetails.toNetwork &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.fromCoin &&
			$SendTxDetails.fromNetwork &&
			$SendTxDetails.toAmount &&
			amountNumber > 0 &&
			amountNumber <= (max?.toNumber() ?? Number.MAX_SAFE_INTEGER) &&
			!toSelf
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});
	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));

	let lastPaid = $state('Never');
	let lastNetwork = $state('Never');
	$effect(() => {
		if (!auth.value) return;
		Promise.all([
			getLastPaidContact(toDid),
			getLastPaidNetwork($SendTxDetails.toNetwork?.value)
		]).then(([paid, net]) => {
			lastPaid = momentToLastPaidString(paid);
			lastNetwork = momentToLastPaidString(net);
		});
	});

	$effect(() => {
		const newNetwork = $SendTxDetails.toNetwork;
		const userNetworks = getRecipientNetworks(getDidFromUsername($SendTxDetails.toUsername));
		if (userNetworks.find((net) => net.value === newNetwork?.value)?.disabled) {
			$SendTxDetails.toNetwork = Network.vsc;
		}
	});

	function openContact(create = false) {
		openToCreate = create;
		toggleContact(true);
	}

	let contactOpen = $state(false);
	let toggleContact = $state<(open?: boolean) => void>(() => {});
	let contact = $state<Contact>();
	let createNew: string | undefined = $derived(
		!contact && $SendTxDetails.toUsername ? $SendTxDetails.toUsername : undefined
	);
	let openToCreate = $state(false);

	// AMOUNT
	const fromAssetObjs: AssetObject[] = $derived(
		swapOptions.from.coins.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.toNetwork, size: 'medium' }
		}))
	);

	let isSwap = $derived(
		$SendTxDetails.fromCoin &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.fromCoin?.coin.value !== $SendTxDetails.toCoin?.coin.value
	);

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
	let fromAmount = $state('');
	let inUsd = $state('');
	let max: CoinAmount<Coin> | undefined = $state();
	let amountNumber = $derived(parseFloat(fromAmount));

	$effect(() => {
		if (fromAmount !== $SendTxDetails.toAmount) {
			untrack(() => {
				if ($SendTxDetails.toCoin && $SendTxDetails.toCoin !== $SendTxDetails.fromCoin) {
					const fromCoin = swapOptions.from.coins.find((coin) => coin.coin.value === fromCoinValue);
					if (fromCoin && $SendTxDetails.fromCoin) {
						Promise.all([
							new CoinAmount(fromAmount, $SendTxDetails.toCoin!.coin).convertTo(
								fromCoin.coin,
								Network.lightning
							),
							getFee(fromAmount)
						]).then(([amount, fee]) => {
							$SendTxDetails.toAmount = fromAmount;
							$SendTxDetails.fromAmount = amount.toAmountString();
							$SendTxDetails.fee = fee;
						});
						return;
					}
				}
				$SendTxDetails.fromAmount = $SendTxDetails.toAmount = fromAmount;
			});
		}
	});

	let toSelf = $derived(
		$SendTxDetails.toUsername === getUsernameFromAuth(auth) &&
			$SendTxDetails.fromNetwork?.value === $SendTxDetails.toNetwork?.value
	);

	let assetOpen = $state(false);
	let toggleAsset = $state<(open?: boolean) => void>(() => {});

	// INTERNAL/EXTERNAL
	let currentType: 'internal' | 'external' = $state('internal');
	let toNetworkOptions: NetworkOptionParam[] = $state([]);
	let transferError = $state('');
	function getDisabledReason() {
		if ($SendTxDetails.toUsername === getUsernameFromAuth(auth)) {
			return 'Cannot send funds to yourself on the same network.';
		}
		if (getDidFromUsername($SendTxDetails.toUsername).startsWith('did:pkh:eip155:1:')) {
			return 'EVM accounts may only receive funds on VSC.';
		}
		if ($SendTxDetails.fromCoin?.coin.value === Coin.shbd.value) {
			return 'Cannot transfer sHBD to external networks.';
		}
		return 'This option is not available given your parameters.';
	}
	$effect(() => {
		$SendTxDetails;
		untrack(() => {
			const newOptions = solveToNetworks();
			const oldSet = new Set(toNetworkOptions.map((net) => net.value));
			const newSet = new Set(newOptions.map((net) => net.value));
			if (
				newOptions.length === 0 &&
				$SendTxDetails.toUsername &&
				$SendTxDetails.fromCoin &&
				$SendTxDetails.fromNetwork
			) {
				transferError = `Cannot transfer ${$SendTxDetails.fromCoin.coin.label} 
					from ${$SendTxDetails.fromNetwork.label} 
					to ${$SendTxDetails.toDisplayName}.`;
			} else {
				transferError = '';
			}
			if (oldSet.symmetricDifference(newSet).size === 0) {
				return;
			}
			if (newOptions.length === 1) {
				if (newOptions[0].value === Network.vsc.value) {
					currentType = 'internal';
				} else {
					currentType = 'external';
				}
			}
			toNetworkOptions = newOptions;
		});
	});
	$effect(() => {
		currentType;
		toNetworkOptions;
		untrack(() => {
			const network =
				currentType === 'internal'
					? Network.vsc
					: toNetworkOptions.find((net) => net.value !== Network.vsc.value);
			if (network?.value === $SendTxDetails.toNetwork?.value) return;
			$SendTxDetails.toNetwork = network;
		});
	});
	$effect(() => {
		$SendTxDetails.fromCoin;
		untrack(() => {
			if ($SendTxDetails.toCoin?.coin.value !== $SendTxDetails.fromCoin?.coin.value) {
				$SendTxDetails.toCoin = $SendTxDetails.fromCoin;
			}
		});
	});
	type TransferType = ComponentProps<typeof TransferBar>;
	interface TransferBarItem extends TransferType {
		label: string;
		snippet: (params: TransferType) => ReturnType<Snippet>;
		disabled?: boolean;
		disabledMemo?: string;
	}
	const transferTypes: TransferBarItem[] = $derived.by(() => {
		const baseOptions: TransferBarItem[] = [
			{ value: 'internal', label: 'Internal Transfer', snippet: transferBar },
			{ value: 'external', label: 'External Transfer', snippet: transferBar }
		];
		if (toNetworkOptions.length === 0) {
			return baseOptions;
		} else {
			const disabledReason = getDisabledReason();
			const options: TransferBarItem[] = toNetworkOptions
				.map((net) => ({
					value: (net.value === Network.vsc.value ? 'internal' : 'external') as
						| 'internal'
						| 'external',
					label: `${net.value === Network.vsc.value ? 'Internal' : 'External'} Transfer`,
					to: net,
					from: $SendTxDetails.fromNetwork,
					snippet: transferBar
				}))
				.sort((a, b) => (a.value === b.value ? 0 : a.value === 'internal' ? -1 : 1));
			if (options.length < 2) {
				const addOpt = baseOptions.find(
					(baseOpt) => !options.map((enabledOpt) => enabledOpt.value).includes(baseOpt.value)
				);
				if (addOpt) {
					options.push({ ...addOpt, disabled: true, disabledMemo: disabledReason });
				}
			}
			return options;
		}
	});

	// DETAILS
	let memo = $state('');
	let inputId = $state('');
</script>

{#snippet transferBar(params: TransferType)}
	<TransferBar {...params} />
{/snippet}

<h2>Transfer</h2>
<div class="sections">
	<div class="contact-search">
		<RecipientCard edit={openContact} {contact} />
		<ContactSearchBox bind:value={$SendTxDetails.toUsername} bind:selectedContact={contact} />
	</div>
	<Divider text="Amount" />
	<ClickableCard onclick={() => toggleAsset(true)}>
		<div class="asset-card">
			{#if $SendTxDetails.fromCoin && $SendTxDetails.fromNetwork}
				<BalanceInfo
					coin={$SendTxDetails.fromCoin.coin}
					network={$SendTxDetails.fromNetwork}
					size="large"
					styleType="vertical"
				/>
				<!-- <AssetInfo coinOpt={$SendTxDetails.fromCoin} size="medium" /> -->
			{:else}
				<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
				Select Asset
			{/if}
			<span class="more">
				<EditButton onclick={() => toggleAsset(true)} />
			</span>
		</div>
	</ClickableCard>
	<div class="amounts">
		<div class="inputs">
			<AmountInput
				bind:amount={fromAmount}
				coinOpt={$SendTxDetails.fromCoin}
				network={$SendTxDetails.fromNetwork}
				maxAmount={max}
				bind:id={inputId}
			/>
			<!-- <Link2 />
			<AmountInput
				bind:amount={inUsd}
				coinOpt={{
					coin: coins.usd,
					networks: []
				}}
				network={undefined}
				connectedCoinAmount={new CoinAmount(fromAmount, $SendTxDetails.fromCoin?.coin ?? Coin.unk)}
			/> -->
		</div>
	</div>
	<div class="select-wrapper">
		{#if transferError}
			<div class="transfer-error error">{transferError}</div>
		{:else}
			<Select
				items={transferTypes}
				onValueChange={(details) => (currentType = details.value[0] as 'internal' | 'external')}
				styleType="dropdown"
				initial={currentType}
			/>
		{/if}
	</div>
	<Divider text="Details" />
	<!-- <h4>Details</h4> -->
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
</div>

<Dialog bind:open={contactOpen} bind:toggle={toggleContact}>
	{#snippet content()}
		<SelectContact
			bind:selectedContact={contact}
			editing={openToCreate}
			close={toggleContact}
			{createNew}
		/>
	{/snippet}
</Dialog>
<Dialog bind:open={assetOpen} bind:toggle={toggleAsset}>
	{#snippet content()}
		<SelectAssetFlattened
			availableCoins={fromAssetObjs}
			close={toggleAsset}
			bind:coin={$SendTxDetails.fromCoin}
			bind:network={$SendTxDetails.fromNetwork}
			bind:max
			externalNetwork={Network.hiveMainnet}
		/>
	{/snippet}
</Dialog>

<style lang="scss">
	.contact-search {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.5rem;
		background-color: var(--neutral-bg-accent);
		border-radius: 1rem;
		@media screen and (min-width: 450px) {
			:global(input) {
				background-color: var(--neutral-bg);
			}
		}
		@media screen and (max-width: 450px) {
			background-color: transparent;
			padding: 0;
		}
	}
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.amounts {
		padding: 0.5rem 0;
		.inputs {
			display: flex;
			align-items: flex-start;
			gap: 0.5rem;
			:global(.lucide-link-2) {
				min-width: 24px;
				height: 44px;
			}
			@media screen and (max-width: 450px) {
				flex-direction: column;
				align-items: stretch;
				gap: 0.25rem;
				:global(.amount-wrapper) {
					width: 100%;
				}
				:global(.lucide-link-2) {
					height: auto;
					align-self: center;
				}
			}
		}
	}
	.select-wrapper {
		.transfer-error {
			filter: grayscale(25%);
			padding: 0.75rem;
			border: 1px solid var(--neutral-bg-accent-shifted);
			background-color: var(--neutral-off-bg);
			border-radius: 0.5rem;
		}
	}
	.asset-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem;
		.more {
			margin-left: auto;
		}
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
