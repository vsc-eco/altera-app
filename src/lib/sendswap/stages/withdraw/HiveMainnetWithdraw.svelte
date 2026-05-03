<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import SelectAssetFlattened from '$lib/sendswap/components/assetSelection/SelectAssetFlattened.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import ContactSearchBox from '$lib/sendswap/contacts/ContactSearchBox.svelte';
	import type { Contact } from '$lib/sendswap/contacts/contacts';
	import swapOptions, { Coin, Network, type CoinOnNetwork } from '$lib/sendswap/utils/sendOptions';
	import { validateAddress } from '$lib/sendswap/utils/sendUtils';
	import { useWithdrawState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import { ArrowLeft, Coins } from '@lucide/svelte';
	import Divider from '$lib/components/Divider.svelte';

	let {
		editStage,
		open,
		secondaryMenu = $bindable(false)
	}: { editStage: (complete: boolean) => void; open: boolean; secondaryMenu: boolean } = $props();

	const txState = useWithdrawState();
	const auth = $derived(getAuth()());

	let coinAmount = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	// For EVM accounts, always start with empty string. For Hive accounts, use txState.toUsername
	let hiveAccount = $state('');
	let hiveAccountError = $state<string | undefined>(undefined);
	let isHiveAccountValid = $state(false);
	let contact = $state<Contact>();
	let contactOpen = $state(false);
	let openToCreate = $state(false);
	let createNew: string | undefined = $derived(
		!contact && txState.toUsername ? txState.toUsername : undefined
	);
	const toggleContact = (open = false) => {
		contactOpen = open;
	};
	function openContact(create = false) {
		openToCreate = create;
		toggleContact(true);
	}

	function setToUsername(nextValue: string) {
		if (txState.toUsername !== nextValue) txState.toUsername = nextValue;
	}
	function syncAmountFromInput(nextAmount: CoinAmount<Coin>) {
		if (!open) return;
		const amt = nextAmount.toAmountString();
		if (txState.toAmount !== amt) txState.toAmount = amt;
		if (txState.fromAmount !== amt) txState.fromAmount = amt;
		if (txState.enteredAmount !== amt) txState.enteredAmount = amt;
	}

	let previousOpen: boolean | undefined;
	let previousProvider: string | undefined;
	let lastSyncedUsername = '';
	let lastValidatedAccount = '';
	let validationRun = 0;

	// Initialize or reset toUsername based on open state and provider.
	$effect(() => {
		const provider = auth.value?.provider;
		if (open === previousOpen && provider === previousProvider) {
			return;
		}
		previousOpen = open;
		previousProvider = provider;

		const currentUsername = txState.toUsername || '';

		if (open) {
			if (auth.value?.provider === 'aioha') {
				// For Hive accounts, use txState.toUsername if available
				hiveAccount = txState.toUsername || '';
			} else {
				const shouldReset =
					!currentUsername || (currentUsername.length === 42 && currentUsername.startsWith('0x'));
				const nextValue = shouldReset ? '' : currentUsername;
				if (nextValue !== currentUsername) {
					setToUsername(nextValue);
				}
			}
		} else {
			// Reset when component closes
			if (auth.value?.provider === 'aioha') {
				hiveAccount = txState.toUsername || '';
			} else {
				hiveAccount = '';
				setToUsername('');
			}
		}
	});

	// Keep local hiveAccount in sync with txState (covers SelectContact updates)
	$effect(() => {
		if (!open) return;
		const current = (txState.toUsername ?? '').trim();
		if (current === lastSyncedUsername) return;
		lastSyncedUsername = current;
		if (hiveAccount !== current) {
			hiveAccount = current;
		}
	});

	// Push local hiveAccount changes back into txState
	$effect(() => {
		if (!open) return;
		const trimmed = hiveAccount.trim();
		if (trimmed === lastSyncedUsername) return;
		lastSyncedUsername = trimmed;
		setToUsername(trimmed);
	});

	// Sync coinAmount → state. Uses local guard to avoid reading state reactively.
	let lastSyncedAmt = '';
	$effect(() => {
		if (!open) return;
		const amt = coinAmount.toAmountString();
		if (amt === lastSyncedAmt) return;
		lastSyncedAmt = amt;
		txState.fromAmount = amt;
		txState.toAmount = amt;
		txState.enteredAmount = amt;
	});

	let max = $state(new CoinAmount(0, Coin.hive));

	// Update max when fromCoin changes for magi network
	$effect(() => {
		if (!open || !txState.fromCoin || !txState.fromNetwork) return;
		if (txState.fromNetwork.value !== Network.magi.value) return;

		const coinValue = txState.fromCoin.coin.value;
		if (coinValue === Coin.hive.value || coinValue === Coin.hbd.value) {
			max = getBalanceAmount(
				$accountBalance,
				txState.fromCoin.coin,
				txState.fromNetwork
			);
		}
	});
	// Validate Hive account for EVM users
	$effect(() => {
		if (!open) return;
		if (auth.value?.provider === 'aioha') {
			// For Hive accounts, toUsername is not required in the same way
			isHiveAccountValid = true;
			return;
		}

		// For EVM accounts, validate the Hive username
		const rawAccount = hiveAccount.trim();
		if (!rawAccount) {
			isHiveAccountValid = false;
			hiveAccountError = undefined;
			lastValidatedAccount = '';
			return;
		}

		if (rawAccount === lastValidatedAccount) {
			return;
		}
		lastValidatedAccount = rawAccount;
		const validationId = ++validationRun;
		// Reject EVM addresses (42 chars starting with 0x) - similar to sendUtils.ts#L70
		if (rawAccount.length === 42 && rawAccount.startsWith('0x')) {
			isHiveAccountValid = false;
			hiveAccountError =
				'EVM addresses are not supported for Hive Mainnet withdrawals. Please use a Hive username.';
			return;
		}

		validateAddress(rawAccount).then((result) => {
			if (validationId !== validationRun) return;
			if (result.success) {
				isHiveAccountValid = true;
				hiveAccountError = undefined;
				setToUsername(rawAccount);
				// toDisplayName not available on WithdrawTxState; skip write
				// if (result.displayName) { txState.toDisplayName = result.displayName; }
			} else {
				isHiveAccountValid = false;
				hiveAccountError = result.error;
			}
		});
	});

	$effect(() => {
		if (!open) return;
		const baseValidation = !!(
			txState.fromCoin &&
			txState.toCoin &&
			txState.fromNetwork &&
			coinAmount.amount > 0 &&
			coinAmount.amount <= (max?.amount ?? Number.MAX_SAFE_INTEGER)
		);

		if (auth.value?.provider === 'aioha') {
			// For Hive accounts, base validation is enough
			editStage(baseValidation);
		} else {
			// For EVM accounts, also require valid Hive account
			editStage(baseValidation && isHiveAccountValid && !!txState.toUsername);
		}
	});

	const unkOpt = { coin: Coin.unk, network: Network.unknown };
	const coinOptions: CoinOnNetwork[] = $derived(
		txState.fromCoin && txState.fromNetwork
			? [{ coin: txState.fromCoin.coin, network: txState.fromNetwork }]
			: [unkOpt]
	);

	let assetOpen = $state(false);
	function toggleAsset(open = false) {
		assetOpen = open;
		// When closing asset picker, sync toCoin to match the newly selected fromCoin
		if (!open) {
			if (txState.fromCoin && txState.toCoin?.coin?.value !== txState.fromCoin?.coin?.value) {
				txState.toCoin = txState.fromCoin;
			}
		}
	}
	$effect(() => {
		secondaryMenu = assetOpen || contactOpen;
	});
</script>

{#if assetOpen}
	<div class="back-button">
		<PillButton onclick={() => toggleAsset()} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
	</div>
	<SelectAssetFlattened
		availableCoins={[Coin.hive, Coin.hbd]}
		close={toggleAsset}
		bind:coin={txState.fromCoin}
		bind:network={txState.fromNetwork}
		bind:max
	/>
{:else}
	<div class="sections">
		{#if auth.value?.provider === 'reown'}
			<div class="section to">
				<ContactSearchBox
					bind:value={hiveAccount}
					bind:selectedContact={contact}
					enableContacts={['hive']}
					placeholder="Enter Hive username"
				/>
				{#if hiveAccountError}
					<span class="error-message">{hiveAccountError}</span>
				{/if}
			</div>
			<Divider text="Amount" />
		{/if}
		<div class="sections">
			<div class="section">
				<label for="asset-card">Withdraw From</label>
				<ClickableCard onclick={() => toggleAsset(true)}>
					<div class="asset-card">
						{#if txState.fromCoin && txState.fromNetwork}
							<BalanceInfo
								coin={txState.fromCoin.coin}
								network={txState.fromNetwork}
								size="large"
								styleType="vertical"
							/>
						{:else}
							<span class="user-icon-placeholder"
								><Coins size="40" absoluteStrokeWidth={true} /></span
							>
							Select Withdrawal Asset
						{/if}
						<span class="edit"> Edit </span>
					</div>
				</ClickableCard>
			</div>
			<div class="section">
				<label for={inputId}>Amount</label>
				<div class="amount-row">
					<div class="amount-input">
						<AmountInput
							bind:coinAmount
							coinOpts={coinOptions}
							expressIn={txState.fromCoin?.coin}
							maxAmount={max}
							onAmountChange={syncAmountFromInput}
							bind:id={inputId}
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.amount-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		.amount-input {
			flex-grow: 1;
			height: 65px;
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
	}
	.error-message {
		color: var(--dash-accent-red);
		font-size: 0.875rem;
		margin-top: 0.5rem;
		display: block;
	}
	.to {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
