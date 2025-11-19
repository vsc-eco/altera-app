<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import SelectAssetFlattened from '$lib/sendswap/components/assetSelection/SelectAssetFlattened.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import ContactSearchBox from '$lib/sendswap/contacts/ContactSearchBox.svelte';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork
	} from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails, validateAddress } from '$lib/sendswap/utils/sendUtils';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { ArrowLeft, Coins } from '@lucide/svelte';

	let {
		editStage,
		open,
		secondaryMenu = $bindable()
	}: { editStage: (complete: boolean) => void; open: boolean; secondaryMenu: boolean } = $props();

	const auth = $derived(getAuth()());

	let coinAmount = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	// For EVM accounts, always start with empty string. For Hive accounts, use SendTxDetails.toUsername
	let hiveAccount = $state('');
	let hiveAccountError = $state<string | undefined>(undefined);
	let isHiveAccountValid = $state(false);

	// Initialize or reset hiveAccount based on open state
	$effect(() => {
		if (open) {
			if (auth.value?.provider === 'aioha') {
				// For Hive accounts, use SendTxDetails.toUsername if available
				hiveAccount = $SendTxDetails.toUsername || '';
			} else {
				// For EVM accounts, always start with empty string
				// Only use SendTxDetails.toUsername if it's a valid Hive username (not EVM address)
				const currentUsername = $SendTxDetails.toUsername || '';
				if (currentUsername && !(currentUsername.length === 42 && currentUsername.startsWith('0x'))) {
					hiveAccount = currentUsername;
				} else {
					hiveAccount = '';
				}
			}
		} else {
			// Reset when component closes
			if (auth.value?.provider === 'aioha') {
				hiveAccount = $SendTxDetails.toUsername || '';
			} else {
				hiveAccount = '';
			}
		}
	});

	// Update SendTxDetails with coinAmount
	$effect(() => {
		if (!open) return;
		if (!$SendTxDetails.toCoin) return;
		const amt = coinAmount.toAmountString();
		if (amt !== $SendTxDetails.toAmount) {
			$SendTxDetails.toAmount = $SendTxDetails.fromAmount = amt;
		}
	});

	let max: CoinAmount<Coin> | undefined = $state();

	// Validate Hive account for EVM users
	$effect(() => {
		if (!open) return;
		if (auth.value?.provider === 'aioha') {
			// For Hive accounts, toUsername is not required in the same way
			isHiveAccountValid = true;
			return;
		}

		// For EVM accounts, validate the Hive username
		if (!hiveAccount || hiveAccount.trim() === '') {
			isHiveAccountValid = false;
			hiveAccountError = undefined;
			return;
		}

		const trimmedAccount = hiveAccount.trim();
		// Reject EVM addresses (42 chars starting with 0x) - similar to sendUtils.ts#L70
		if (trimmedAccount.length === 42 && trimmedAccount.startsWith('0x')) {
			isHiveAccountValid = false;
			hiveAccountError =
				'EVM addresses are not supported for Hive Mainnet withdrawals. Please use a Hive username.';
			return;
		}

		validateAddress(trimmedAccount).then((result) => {
			if (result.success) {
				isHiveAccountValid = true;
				hiveAccountError = undefined;
				$SendTxDetails.toUsername = trimmedAccount;
				if (result.displayName) {
					$SendTxDetails.toDisplayName = result.displayName;
				}
			} else {
				isHiveAccountValid = false;
				hiveAccountError = result.error;
			}
		});
	});

	$effect(() => {
		if (!open) return;
		const baseValidation = !!(
			$SendTxDetails.fromCoin &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.toAmount &&
			$SendTxDetails.toNetwork &&
			coinAmount.amount > 0 &&
			coinAmount.amount <= (max?.amount ?? Number.MAX_SAFE_INTEGER)
		);

		if (auth.value?.provider === 'aioha') {
			// For Hive accounts, base validation is enough
			editStage(baseValidation);
		} else {
			// For EVM accounts, also require valid Hive account
			editStage(baseValidation && isHiveAccountValid && !!$SendTxDetails.toUsername);
		}
	});

	const unkOpt = { coin: Coin.unk, network: Network.unknown };
	const coinOptions: CoinOnNetwork[] = $derived(
		$SendTxDetails.toCoin && $SendTxDetails.toNetwork
			? [{ coin: $SendTxDetails.toCoin.coin, network: $SendTxDetails.toNetwork }]
			: [unkOpt]
	);

	let assetOpen = $state(false);
	const toggleAsset = (open = false) => {
		assetOpen = open;
	};
	$effect(() => {
		secondaryMenu = assetOpen;
	});

	// Ensure toCoin is valid for Hive Mainnet (HIVE or HBD)
	$effect(() => {
		if (
			$SendTxDetails.toCoin &&
			![Coin.hive.value, Coin.hbd.value].includes($SendTxDetails.toCoin.coin.value)
		) {
			$SendTxDetails.toCoin = undefined;
		}
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
		bind:coin={$SendTxDetails.toCoin}
		bind:network={$SendTxDetails.toNetwork}
		bind:max
		showEmptyAccounts
	/>
{:else if auth.value?.provider === 'aioha'}
	<div class="sections">
		<ClickableCard onclick={() => toggleAsset(true)}>
			<div class="asset-card">
				{#if $SendTxDetails.toCoin && $SendTxDetails.toNetwork}
					<BalanceInfo
						coin={$SendTxDetails.toCoin.coin}
						network={$SendTxDetails.toNetwork}
						size="large"
						styleType="vertical"
					/>
				{:else}
					<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
					Select Withdraw Asset
				{/if}
				<span class="edit"> Edit </span>
			</div>
		</ClickableCard>
		<div class="section">
			<label for={inputId}>Amount</label>
			<div class="amount-row">
				<div class="amount-input">
					<AmountInput
						bind:coinAmount
						coinOpts={coinOptions}
						expressIn={$SendTxDetails.toCoin?.coin}
						maxAmount={max}
						bind:id={inputId}
					/>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- EVM accounts -->
	<div class="sections">
		<div class="section">
			<span class="label-like">Hive Account</span>
			<ContactSearchBox
				bind:value={hiveAccount}
				enableContacts={true}
				placeholder="Enter Hive username"
			/>
			{#if hiveAccountError}
				<span class="error-message">{hiveAccountError}</span>
			{/if}
		</div>
		<ClickableCard onclick={() => toggleAsset(true)}>
			<div class="asset-card">
				{#if $SendTxDetails.toCoin && $SendTxDetails.toNetwork}
					<BalanceInfo
						coin={$SendTxDetails.toCoin.coin}
						network={$SendTxDetails.toNetwork}
						size="large"
						styleType="vertical"
					/>
				{:else}
					<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
					Select Withdraw Asset
				{/if}
				<span class="edit"> Edit </span>
			</div>
		</ClickableCard>
		<div class="section">
			<label for={inputId}>Amount</label>
			<div class="amount-row">
				<div class="amount-input">
					<AmountInput
						bind:coinAmount
						coinOpts={coinOptions}
						expressIn={$SendTxDetails.toCoin?.coin}
						maxAmount={max}
						bind:id={inputId}
					/>
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
		color: var(--error-color, #ff4444);
		font-size: 0.875rem;
		margin-top: 0.5rem;
		display: block;
	}
</style>

