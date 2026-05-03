<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromAuth } from '$lib/getAccountName';
	import { Coins } from '@lucide/svelte';
	import { untrack, type ComponentProps, type Snippet } from 'svelte';
	import {
		momentToLastPaidString,
		getLastPaidContact,
		getLastPaidNetwork,
		getRecipientNetworks,
		getFee,
		solveToNetworks,
		type NetworkOptionParam
	} from '../utils/sendUtils';
	import { useTransferState } from '../utils/txState.svelte';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork,
		type CoinOptions
	} from '../utils/sendOptions';
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
	import TransferBar from '../components/TransferBar.svelte';
	import SelectAssetFlattened from '../components/assetSelection/SelectAssetFlattened.svelte';
	import Select from '$lib/zag/Select.svelte';
	import Divider from '$lib/components/Divider.svelte';
	import BalanceInfo from '../components/info/BalanceInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';
	import {
		estimateBtcUnmapFee,
		type BtcFeeEstimate
	} from '$lib/magiTransactions/bitcoin/btcFeeEstimate';
	import { numberFormatLanguage } from '$lib/constants';

	let {
		editStage
	}: {
		editStage: (add: boolean) => void;
	} = $props();

	const txState = useTransferState();
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
			txState.toUsername &&
			txState.toNetwork &&
			txState.toCoin &&
			txState.fromCoin &&
			txState.fromNetwork &&
			txState.toAmount &&
			inputAmt.amount > 0 &&
			inputAmt.amount <= (max?.amount ?? Number.MAX_SAFE_INTEGER) &&
			!toSelf
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});
	const toDid = $derived(getDidFromUsername(txState.toUsername));

	let lastPaid = $state('Never');
	let lastNetwork = $state('Never');
	$effect(() => {
		if (!auth.value) return;
		Promise.all([
			getLastPaidContact(toDid),
			getLastPaidNetwork(txState.toNetwork?.value)
		]).then(([paid, net]) => {
			lastPaid = momentToLastPaidString(paid);
			lastNetwork = momentToLastPaidString(net);
		});
	});

	$effect(() => {
		const newNetwork = txState.toNetwork;
		const userNetworks = getRecipientNetworks(getDidFromUsername(txState.toUsername));
		if (userNetworks.find((net) => net.value === newNetwork?.value)?.disabled) {
			txState.toNetwork = Network.magi;
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
		!contact && txState.toUsername ? txState.toUsername : undefined
	);
	let openToCreate = $state(false);

	// AMOUNT
	const fromAssetObjs: AssetObject[] = $derived(
		swapOptions.from.coins.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: txState.toNetwork, size: 'medium' }
		}))
	);

	let isSwap = $derived(
		txState.fromCoin &&
			txState.toCoin &&
			txState.fromCoin?.coin.value !== txState.toCoin?.coin.value
	);

	// default to USD
	$effect(() => {
		if (isSwap && !txState.toCoin) {
			txState.toCoin = {
				coin: coins.usd,
				networks: []
			};
		}
	});

	let inputAmt = $state(new CoinAmount(0, Coin.unk));
	let inUsd = $state('');
	let max: CoinAmount<Coin> | undefined = $state();

	$effect(() => {
		if (txState.fromAmount !== inputAmt.toAmountString()) {
			txState.fromAmount = inputAmt.toAmountString();
		}
		if (txState.toAmount !== inputAmt.toAmountString()) {
			txState.toAmount = inputAmt.toAmountString();
		}
	});

	let toSelf = $derived(
		txState.toUsername === getUsernameFromAuth(auth) &&
			txState.fromNetwork?.value === txState.toNetwork?.value
	);

	let assetOpen = $state(false);
	let toggleAsset = $state<(open?: boolean) => void>(() => {});

	// INTERNAL/EXTERNAL
	let currentType: 'internal' | 'external' = $state('internal');
	let toNetworkOptions: NetworkOptionParam[] = $state([]);
	let transferError = $state('');
	function getDisabledReason() {
		if (txState.toUsername === getUsernameFromAuth(auth)) {
			return 'Cannot send funds to yourself on the same network.';
		}
		if (getDidFromUsername(txState.toUsername).startsWith('did:pkh:eip155:1:')) {
			return 'EVM accounts may only receive funds on Magi.';
		}
		if (txState.fromCoin?.coin.value === Coin.shbd.value) {
			return 'Cannot transfer sHBD to external networks.';
		}
		return 'This option is not available given your parameters.';
	}
	$effect(() => {
		// read reactive fields to track changes
		txState.toUsername; txState.fromCoin; txState.fromNetwork; txState.toCoin;
		untrack(() => {
			const newOptions = solveToNetworks(txState);
			const oldSet = new Set(toNetworkOptions.map((net) => net.value));
			const newSet = new Set(newOptions.map((net) => net.value));
			if (
				newOptions.length === 0 &&
				txState.toUsername &&
				txState.fromCoin &&
				txState.fromNetwork
			) {
				transferError = `Cannot transfer ${txState.fromCoin.coin.label} 
					from ${txState.fromNetwork.label} 
					to ${txState.toDisplayName}.`;
			} else {
				transferError = '';
			}
			if (oldSet.symmetricDifference(newSet).size === 0) {
				return;
			}
			if (newOptions.length === 1) {
				if (newOptions[0].value === Network.magi.value) {
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
					? Network.magi
					: toNetworkOptions.find((net) => net.value !== Network.magi.value);
			if (network?.value === txState.toNetwork?.value) return;
			txState.toNetwork = network;
		});
	});
	$effect(() => {
		txState.fromCoin;
		untrack(() => {
			if (txState.toCoin?.coin.value !== txState.fromCoin?.coin.value) {
				txState.toCoin = txState.fromCoin;
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
					value: (net.value === Network.magi.value ? 'internal' : 'external') as
						| 'internal'
						| 'external',
					label: `${net.value === Network.magi.value ? 'Internal' : 'External'} Transfer`,
					to: net,
					from: txState.fromNetwork,
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

	// BTC network-fee estimate (only relevant when the transfer settles out
	// to BTC mainnet). Matches the math the VSC contract uses at unmap time.
	const isToBtcMainnet = $derived(
		txState.fromCoin?.coin.value === Coin.btc.value &&
			txState.toNetwork?.value === Network.btcMainnet.value
	);
	let btcFeeEstimate = $state<BtcFeeEstimate | null>(null);
	$effect(() => {
		if (!isToBtcMainnet) {
			btcFeeEstimate = null;
			return;
		}
		let cancelled = false;
		estimateBtcUnmapFee().then((est) => {
			if (!cancelled) btcFeeEstimate = est;
		});
		return () => {
			cancelled = true;
		};
	});
	function formatSats(sats: number): string {
		return new Intl.NumberFormat(numberFormatLanguage, { useGrouping: true }).format(
			Math.max(0, Math.round(sats))
		);
	}

	// DETAILS
	let memo = $state('');
	let inputId = $state('');

	const coinOpts: CoinOnNetwork[] = $derived(
		txState.fromCoin && txState.fromNetwork
			? [{ coin: txState.fromCoin.coin, network: txState.fromNetwork }]
			: [{ coin: Coin.unk, network: Network.unknown }]
	);

	const coinsWithBalance = $derived.by(() => {
		const result: Array<{ coin: Coin; coinOpt: CoinOptions['coins'][number] }> = [];
		for (const coinOpt of swapOptions.from.coins) {
			const coinValue = coinOpt.coin.value;
			if (coinValue in $accountBalance.bal) {
				const balance = $accountBalance.bal[coinValue as keyof AccountBalance];
				const coinAmt = new CoinAmount(balance, coinOpt.coin, true);
				if (coinAmt.amount > 0.001) {
					result.push({ coin: coinOpt.coin, coinOpt });
				}
			}
		}
		return result;
	});

	const hasAnyBalance = $derived(coinsWithBalance.length > 0);

	$effect(() => {
		const balanceCount = coinsWithBalance.length;
		if (balanceCount === 0) return;

		const currentCoinHasBalance =
			txState.fromCoin &&
			coinsWithBalance.some((item) => item.coin.value === txState.fromCoin?.coin.value);

		if (currentCoinHasBalance) return;

		const hiveCoin = coinsWithBalance.find((item) => item.coin.value === Coin.hive.value);
		const coinToSelect = hiveCoin || coinsWithBalance[0];

		if (coinToSelect) {
			txState.fromCoin = coinToSelect.coinOpt;
			txState.fromNetwork = Network.magi;
			txState.toCoin = coinToSelect.coinOpt;
			txState.toNetwork = Network.magi;
		}
	});
</script>

{#snippet transferBar(params: TransferType)}
	<TransferBar {...params} />
{/snippet}

<h2>Transfer</h2>
<div class="sections">
	<div class="contact-search">
		<RecipientCard edit={openContact} {contact} />
		<ContactSearchBox bind:value={txState.toUsername} bind:selectedContact={contact} />
	</div>
	<Divider text="Amount" />
	<ClickableCard onclick={() => toggleAsset(true)}>
		<div class="asset-card">
			{#if !hasAnyBalance}
				<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
				<div class="error">
					No balance found on your account. Please make a deposit to get started.
				</div>
			{:else if txState.fromCoin && txState.fromNetwork}
				<BalanceInfo
					coin={txState.fromCoin.coin}
					network={txState.fromNetwork}
					size="large"
					styleType="vertical"
				/>
				<!-- <AssetInfo coinOpt={txState.fromCoin} size="medium" /> -->
			{:else}
				<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
				Select Asset
			{/if}

			<span class="edit">Edit</span>
		</div>
	</ClickableCard>
	<div class="amounts">
		<div class="inputs">
			<AmountInput
				bind:coinAmount={inputAmt}
				{coinOpts}
				expressIn={txState.fromCoin?.coin}
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
				connectedCoinAmount={new CoinAmount(fromAmount, txState.fromCoin?.coin ?? Coin.unk)}
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
	{#if isToBtcMainnet}
		<div class="btc-unmap-options">
			<label class="deduct-fee-row">
				<input type="checkbox" bind:checked={txState.btcDeductFee} />
				<span class="deduct-fee-label">Deduct fee from amount</span>
				<span class="deduct-fee-hint"
					>Fee is subtracted from your withdrawal instead of added on top</span
				>
			</label>
			<div class="fee-row">
				<div class="fee-field">
					<span class="fee-label">Estimated Fee</span>
					<div class="fee-display">
						{#if btcFeeEstimate}
							~{formatSats(btcFeeEstimate.minSats)} – {formatSats(btcFeeEstimate.maxSats)} sats
						{:else}
							…
						{/if}
					</div>
					<span class="fee-hint">Approximate network fee at the current base rate</span>
				</div>
				<div class="fee-field">
					<span class="fee-label">Max fee (sats)</span>
					<input
						type="number"
						placeholder="No limit"
						value={txState.btcMaxFee ?? ''}
						onchange={(e) => {
							const val = parseInt(e.currentTarget.value)
							txState.btcMaxFee = isNaN(val) ? undefined : val
						}}
					/>
					<span class="fee-hint">Transaction reverts if total fee exceeds this amount</span>
				</div>
			</div>
		</div>
	{/if}
	<Divider text="Details" />
	<!-- <h4>Details</h4> -->
	<div class="details">
		<span class="sm-caption">Memo (optional)</span>
		<input
			bind:value={memo}
			maxlength="300"
			onchange={() => {
				txState.memo = memo;
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
			bind:coin={txState.fromCoin}
			bind:network={txState.fromNetwork}
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
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		@media screen and (min-width: 450px) {
			:global(input) {
				background-color: rgba(0, 0, 0, 0.25);
				border: 1px solid rgba(255, 255, 255, 0.08);
				border-radius: 12px;
			}
		}
		@media screen and (max-width: 450px) {
			background-color: transparent;
			border: none;
			padding: 0;
		}
	}
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 70%;
		margin: 0 auto;
		width: 100%;
		@media screen and (max-width: 450px) {
			max-width: 100%;
		}
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
			border: 1px solid var(--dash-card-border);
			background: var(--dash-surface);
			border-radius: 12px;
		}
	}
	.asset-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem;
		.edit {
			margin-left: auto;
		}
		.error {
			font-size: var(--text-sm);
		}
	}
	.btc-unmap-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		padding: 1rem;
		font-family: 'Nunito Sans', sans-serif;
	}
	.deduct-fee-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		input[type='checkbox'] {
			width: 1rem;
			height: 1rem;
			accent-color: #6F6AF8;
			cursor: pointer;
		}
	}
	.deduct-fee-label {
		font-weight: 500;
		color: var(--dash-text-primary);
		font-size: var(--text-sm);
	}
	.deduct-fee-hint {
		width: 100%;
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
	}
	.fee-row {
		display: flex;
		gap: 1rem;
		@media screen and (max-width: 450px) {
			flex-direction: column;
		}
	}
	.fee-field {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-family: 'Nunito Sans', sans-serif;
		input,
		.fee-display {
			width: 100%;
			box-sizing: border-box;
			background-color: rgba(0, 0, 0, 0.25);
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 12px;
			padding: 0.625rem 0.75rem;
			color: var(--dash-text-primary);
			font-family: 'Nunito Sans', sans-serif;
			font-size: var(--text-sm);
		}
		input {
			&::placeholder { color: var(--dash-text-muted); }
			&:focus { outline: none; border-color: #6F6AF8; }
		}
		.fee-display {
			color: var(--dash-text-muted);
		}
	}
	.fee-label {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--dash-text-primary);
	}
	.fee-hint {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
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
