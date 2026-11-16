<script lang="ts">
	import { PageHeader } from '$lib/ui';
	import { getAuth } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromAuth } from '$lib/getAccountName';
	import { Check } from '@lucide/svelte';
	import { untrack, type ComponentProps, type Snippet } from 'svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import {
		momentToLastPaidString,
		getLastPaidContact,
		getLastPaidNetwork,
		getRecipientNetworks,
		solveToNetworks,
		type NetworkOptionParam
	} from '../utils/sendUtils';
	import { useTransferState } from '../utils/txState.svelte';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork,
		type AssetOption
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
	import ContactSearchBox from '$lib/sendswap/contacts/ContactSearchBox.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { type AssetObject } from '../components/info/SendSnippets.svelte';
	import AssetInfo from '../components/info/AssetInfo.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import TransferBar from '../components/TransferBar.svelte';
	import SelectAssetFlattened from '../components/assetSelection/SelectAssetFlattened.svelte';
	import Select from '$lib/zag/Select.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import {
		accountBalance,
		getBalanceAmount,
		type AccountBalance
	} from '$lib/stores/currentBalance';
	import {
		estimateBtcUnmapFee,
		type BtcFeeEstimate
	} from '$lib/magiTransactions/bitcoin/btcFeeEstimate';
	import BtcVaultRotationNotice from '../components/BtcVaultRotationNotice.svelte';
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
			txState.to &&
			txState.from &&
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
		Promise.all([getLastPaidContact(toDid), getLastPaidNetwork(txState.to?.network.value)]).then(
			([paid, net]) => {
				lastPaid = momentToLastPaidString(paid);
				lastNetwork = momentToLastPaidString(net);
			}
		);
	});

	$effect(() => {
		const newNetwork = txState.to?.network;
		const userNetworks = getRecipientNetworks(getDidFromUsername(txState.toUsername));
		if (userNetworks.find((net) => net.value === newNetwork?.value)?.disabled) {
			if (txState.to) txState.to = { coin: txState.to.coin, network: Network.magi };
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
		swapOptions.from.map((opt) => ({
			...opt.coin,
			component: AssetInfo,
			props: { coinOpt: opt, network: txState.to?.network, size: 'medium' }
		}))
	);

	let isSwap = $derived(
		txState.from && txState.to && txState.from.coin.value !== txState.to.coin.value
	);

	// default to USD
	$effect(() => {
		if (isSwap && !txState.to) {
			txState.to = { coin: coins.usd, network: Network.magi };
		}
	});

	let inputAmt = $state(new CoinAmount(0, Coin.unk));
	let inUsd = $state('');
	let max: CoinAmount<Coin> | undefined = $state();

	// True when the selected from-asset is BTC on the Magi network so we know
	// to offer SATS as an alternate denomination and sync max accordingly.
	const isBtcOnMagi = $derived(
		txState.from?.coin.value === Coin.btc.value &&
			txState.from?.network.value === Network.magi.value
	);

	$effect(() => {
		const fromCoin = txState.from?.coin;
		let amountStr: string;
		// SATS and BTC share the same raw integer unit — rewrap in BTC denomination
		// before storing so the transaction builder always receives a BTC-format string.
		if (fromCoin && fromCoin.value === Coin.btc.value && inputAmt.coin.value === Coin.sats.value) {
			amountStr = new CoinAmount(inputAmt.amount, fromCoin, true).toAmountString();
		} else {
			amountStr = inputAmt.toAmountString();
		}
		if (txState.fromAmount !== amountStr) txState.fromAmount = amountStr;
		if (txState.toAmount !== amountStr) txState.toAmount = amountStr;
	});

	/**
	 * `max` follows the selected asset's LIVE balance.
	 *
	 * It used to be written only by the asset dialog, plus a BTC-on-Magi
	 * special case here. Step 1 is now a chip row that sets the asset without
	 * opening that dialog, so on this path nothing would have set `max` for
	 * HIVE / HBD / sHBD — and `max` is what bounds the amount check above
	 * (`inputAmt.amount <= (max?.amount ?? MAX_SAFE_INTEGER)`), so leaving it
	 * undefined would silently accept ANY amount.
	 *
	 * Deriving it from the balance also fixes it going stale: balances poll
	 * every 5s, and the dialog only ever set `max` at the moment it closed.
	 */
	$effect(() => {
		const from = txState.from;
		if (!from || from.coin.value === Coin.unk.value) {
			max = undefined;
			return;
		}
		const balance = getBalanceAmount($accountBalance, from.coin, from.network);
		// BTC on Magi can be typed in SATS. BTC and SATS share the same raw
		// integer unit, so re-wrapping the raw amount in whichever unit the
		// input is using keeps the Max button matching what gets typed.
		const unit = isBtcOnMagi && inputAmt.coin.value !== Coin.unk.value ? inputAmt.coin : from.coin;
		max = new CoinAmount(balance.amount, unit, true);
	});

	let toSelf = $derived(
		txState.toUsername === getUsernameFromAuth(auth) &&
			txState.from?.network.value === txState.to?.network.value
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
		if (txState.from?.coin.value === Coin.shbd.value) {
			return 'Cannot transfer sHBD to external networks.';
		}
		return 'This option is not available given your parameters.';
	}
	$effect(() => {
		// read reactive fields to track changes
		txState.toUsername;
		txState.from;
		txState.to?.coin;
		untrack(() => {
			const newOptions = solveToNetworks(txState);
			const oldSet = new Set(toNetworkOptions.map((net) => net.value));
			const newSet = new Set(newOptions.map((net) => net.value));
			if (newOptions.length === 0 && txState.toUsername && txState.from) {
				transferError = `Cannot transfer ${txState.from.coin.label}
					from ${txState.from.network.label}
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
			if (network?.value === txState.to?.network.value) return;
			if (!network) {
				txState.to = undefined;
			} else if (txState.to) {
				txState.to = { coin: txState.to.coin, network };
			} else if (txState.from) {
				txState.to = { coin: txState.from.coin, network };
			}
		});
	});
	$effect(() => {
		txState.from?.coin;
		untrack(() => {
			if (txState.to?.coin.value !== txState.from?.coin.value) {
				if (!txState.from) {
					txState.to = undefined;
				} else {
					txState.to = {
						coin: txState.from.coin,
						network: txState.to?.network ?? Network.magi
					};
				}
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
					from: txState.from?.network,
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
		txState.from?.coin.value === Coin.btc.value &&
			txState.to?.network.value === Network.btcMainnet.value
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

	const coinOpts: CoinOnNetwork[] = $derived.by(() => {
		if (!txState.from) {
			return [{ coin: Coin.unk, network: Network.unknown }];
		}
		const base: CoinOnNetwork[] = [txState.from];
		// Offer SATS as an alternate denomination alongside BTC on Magi
		if (isBtcOnMagi) {
			base.push({ coin: Coin.sats, network: Network.magi });
			base.sort((a, b) =>
				a.coin.value === Coin.sats.value ? -1 : b.coin.value === Coin.sats.value ? 1 : 0
			);
		}
		return base;
	});

	const coinsWithBalance = $derived.by(() => {
		const result: Array<{ coin: Coin; coinOpt: AssetOption }> = [];
		for (const coinOpt of swapOptions.from) {
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

	// ─── Step machine (Zag) — drives the timeline indicators ─────────────────
	// Mirrors WithdrawTimeline / DepositTimeline so transfer reads as the same
	// kind of page: asset first, then who, then how much.
	const stepDefs = [
		{ id: 'asset', label: 'I want to send' },
		{ id: 'recipient', label: 'To' },
		{ id: 'amount', label: 'Send' }
	] as const;

	const stepId = $props.id();
	const stepsService = useMachine(steps.machine, {
		id: stepId,
		orientation: 'vertical',
		count: stepDefs.length,
		linear: true
	});
	const stepsApi = $derived(steps.connect(stepsService, normalizeProps));

	const hasRecipient = $derived(!!txState.toUsername?.trim());
	const hasAsset = $derived(!!txState.from && txState.from.coin.value !== Coin.unk.value);

	$effect(() => {
		if (hasAsset && hasRecipient) stepsApi.setStep(2);
		else if (hasAsset) stepsApi.setStep(1);
		else stepsApi.setStep(0);
	});

	/** Step 1's chips. Magi is the only source a chip offers — the dialog
	 *  below step 1 still reaches a mainnet balance. `max` follows from the
	 *  effect above, so nothing here has to set it. */
	function pickAsset(coin: Coin) {
		txState.from = { coin, network: Network.magi };
		txState.to = { coin, network: Network.magi };
	}

	/** The balance behind each chip, for the sub-line. */
	function chipBalance(coin: Coin) {
		return getBalanceAmount($accountBalance, coin, Network.magi);
	}

	$effect(() => {
		const balanceCount = coinsWithBalance.length;
		if (balanceCount === 0) return;

		const currentCoinHasBalance =
			txState.from && coinsWithBalance.some((item) => item.coin.value === txState.from?.coin.value);

		if (currentCoinHasBalance) return;

		const hiveCoin = coinsWithBalance.find((item) => item.coin.value === Coin.hive.value);
		const coinToSelect = hiveCoin || coinsWithBalance[0];

		if (coinToSelect) {
			txState.from = { coin: coinToSelect.coin, network: Network.magi };
			txState.to = { coin: coinToSelect.coin, network: Network.magi };
		}
	});
</script>

{#snippet transferBar(params: TransferType)}
	<TransferBar {...params} />
{/snippet}

<div class="page">
	<div class="main">
		<PageHeader
			titleAs="h2"
			title="Transfer"
			subtitle="Send funds to someone else on Magi."
			hint="A transfer moves what you already hold to another account. It settles in the next block and cannot be reversed, so check the recipient on the review screen."
		/>

		<div {...stepsApi.getRootProps()} class="timeline">
			<!-- ─── Step 1: Asset ──────────────────────────────────────────── -->
			<div {...stepsApi.getItemProps({ index: 0 })} class="timeline-item">
				<div {...stepsApi.getIndicatorProps({ index: 0 })} class="timeline-indicator">
					{#if stepsApi.value > 0}<Check size={14} strokeWidth={3} />{:else}1{/if}
				</div>
				<div class="timeline-content">
					<h4 class="step-heading">{stepDefs[0].label}</h4>
					<div class="step-body">
						{#if !hasAnyBalance}
							<p class="picker-empty">
								No balance found on your account. Make a deposit to get started.
							</p>
						{:else}
							<div class="chip-row">
								{#each coinsWithBalance as item (item.coin.value)}
									<button
										type="button"
										class="asset-chip"
										class:sel={txState.from?.coin.value === item.coin.value &&
											txState.from?.network.value === Network.magi.value}
										onclick={() => pickAsset(item.coin)}
									>
										<img src={item.coin.icon} alt="" width="22" height="22" />
										<span class="chip-text">
											<span class="chip-tk">{item.coin.label}</span>
											<span class="chip-bal">{chipBalance(item.coin).toPrettyAmountString()}</span>
										</span>
									</button>
								{/each}
							</div>
							<p class="held-note">
								Only assets you hold on Magi are shown.
								<!-- The chips cover Magi, which is where a transfer starts almost
								     every time. The picker is still the way to a Hive Mainnet
								     balance, so that path is not lost. -->
								<button type="button" class="link-btn" onclick={() => toggleAsset(true)}>
									Use another asset or network
								</button>
							</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- ─── Step 2: Recipient ──────────────────────────────────────── -->
			<div {...stepsApi.getItemProps({ index: 1 })} class="timeline-item">
				<div {...stepsApi.getIndicatorProps({ index: 1 })} class="timeline-indicator">
					{#if stepsApi.value > 1}<Check size={14} strokeWidth={3} />{:else}2{/if}
				</div>
				<div class="timeline-content">
					<h4 class="step-heading">{stepDefs[1].label}</h4>
					<div class="step-body">
						<div class="contact-search">
							<RecipientCard edit={openContact} {contact} />
							<ContactSearchBox bind:value={txState.toUsername} bind:selectedContact={contact} />
						</div>
					</div>
				</div>
			</div>

			<!-- ─── Step 3: Amount, route and memo ─────────────────────────── -->
			<div {...stepsApi.getItemProps({ index: 2 })} class="timeline-item">
				<div {...stepsApi.getIndicatorProps({ index: 2 })} class="timeline-indicator">
					{#if stepsApi.value > 2}<Check size={14} strokeWidth={3} />{:else}3{/if}
				</div>
				<div class="timeline-content">
					<h4 class="step-heading">{stepDefs[2].label}</h4>
					<div class="step-body">
						{#if !hasAsset}
							<p class="locked-hint">Pick an asset above to continue.</p>
						{:else}
							<div class="amounts">
								<div class="inputs">
									<AmountInput
										bind:coinAmount={inputAmt}
										{coinOpts}
										expressIn={isBtcOnMagi ? undefined : txState.from?.coin}
										maxAmount={max}
										bind:id={inputId}
									/>
								</div>
							</div>
							<div class="select-wrapper">
								{#if transferError}
									<div class="transfer-error error">{transferError}</div>
								{:else}
									<Select
										items={transferTypes}
										onValueChange={(details) =>
											(currentType = details.value[0] as 'internal' | 'external')}
										styleType="dropdown"
										initial={currentType}
									/>
								{/if}
							</div>
							{#if isToBtcMainnet}
								<BtcVaultRotationNotice />
								<div class="btc-unmap-options">
									<label class="deduct-fee-row">
										<input type="checkbox" bind:checked={txState.deductFee} />
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
													~{formatSats(btcFeeEstimate.minSats)} – {formatSats(
														btcFeeEstimate.maxSats
													)} sats
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
												value={txState.maxFee ?? ''}
												onchange={(e) => {
													const val = parseInt(e.currentTarget.value);
													txState.maxFee = isNaN(val) ? undefined : val;
												}}
											/>
											<span class="fee-hint"
												>Transaction reverts if total fee exceeds this amount</span
											>
										</div>
									</div>
								</div>
							{/if}
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
						{/if}
					</div>
				</div>
			</div>
		</div>
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
			bind:selected={txState.from}
			bind:max
			externalNetwork={Network.hiveMainnet}
		/>
	{/snippet}
</Dialog>

<style lang="scss">
	/* ── Timeline chrome ──────────────────────────────────────────────────
	   Deliberately the same values as WithdrawTimeline / DepositTimeline, so
	   the three wallet task pages read as one family. */
	$accent: #6f6af8;
	$accent-soft: rgba(111, 106, 248, 0.16);
	$border: rgba(255, 255, 255, 0.09);
	$border-strong: rgba(255, 255, 255, 0.16);
	$surface: rgba(255, 255, 255, 0.035);

	.page {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0.75rem;
	}
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.timeline-item {
		display: grid;
		grid-template-columns: 2.5rem 1fr;
		gap: 1rem;
		position: relative;
	}
	.timeline-item:not(:last-child)::before {
		content: '';
		position: absolute;
		top: 2.5rem;
		left: 1.2rem;
		bottom: -1.25rem;
		width: 1px;
		background: linear-gradient(to bottom, $border, transparent);
	}
	.timeline-indicator {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: 1px solid $border;
		display: flex;
		align-items: center;
		justify-content: center;
		background: $surface;
		font-weight: 600;
		color: var(--dash-text-secondary);
		font-size: 0.9rem;
		transition: all 200ms ease;
	}
	.timeline-indicator[data-state='current'] {
		border-color: $accent;
		background: $accent-soft;
		color: #fff;
		box-shadow: 0 0 0 4px rgba(111, 106, 248, 0.08);
	}
	.timeline-indicator[data-state='complete'] {
		border-color: $accent;
		background: $accent;
		color: #fff;
	}
	.timeline-content {
		min-width: 0;
	}
	.step-heading {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--dash-text-primary);
		margin: 0;
	}
	.step-body {
		margin-top: 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Step 1 — asset chips with balance */
	.chip-row {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.asset-chip {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.55rem 0.75rem;
		border-radius: 14px;
		border: 1px solid $border;
		background: $surface;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}
	.asset-chip:hover {
		border-color: $border-strong;
	}
	.asset-chip.sel {
		border-color: $accent;
		background: $accent-soft;
	}
	.chip-text {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		text-align: left;
	}
	.chip-tk {
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--dash-text-primary);
	}
	.chip-bal {
		font-size: 0.72rem;
		color: var(--dash-text-secondary);
		font-variant-numeric: tabular-nums;
	}
	.held-note {
		margin: 0;
		font-size: 0.72rem;
		color: var(--dash-text-muted);
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.4rem;
	}
	.link-btn {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--dash-text-accent, #{$accent});
		cursor: pointer;
		text-decoration: underline;
	}
	.locked-hint {
		color: var(--dash-text-muted);
		font-style: italic;
		margin: 0;
	}

	/* Phones: the 2.5rem indicator column plus a 1rem gap is 3.5rem of the
	   screen the form fields need, and the transfer-type dropdown has a
	   min-width that then pushes past the viewport. */
	@media (max-width: 560px) {
		.page {
			padding: 0.5rem 0;
		}
		.timeline-item {
			grid-template-columns: 1.75rem 1fr;
			gap: 0.6rem;
		}
		.timeline-item:not(:last-child)::before {
			top: 1.9rem;
			left: 0.85rem;
		}
		.timeline-indicator {
			width: 1.75rem;
			height: 1.75rem;
			font-size: 0.78rem;
		}
		.chip-row {
			gap: 0.4rem;
		}
	}
	.picker-empty {
		color: var(--dash-text-muted);
		font-style: italic;
		margin: 0;
		padding: 0.5rem 0;
	}

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
			accent-color: #6f6af8;
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
			&::placeholder {
				color: var(--dash-text-muted);
			}
			&:focus {
				outline: none;
				border-color: #6f6af8;
			}
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
