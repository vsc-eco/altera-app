<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import ContactSearchBox from '$lib/sendswap/contacts/ContactSearchBox.svelte';
	import swapOptions, { Coin, Network, type CoinOptions } from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails, validateAddress } from '$lib/sendswap/utils/sendUtils';
	import { accountBalance } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import { ArrowRightLeft } from '@lucide/svelte';
	import { untrack, type ComponentProps } from 'svelte';

	let { editStage, open }: { editStage: (complete: boolean) => void; open: boolean } = $props();

	const auth = $derived(getAuth()());

	let amount = $state('');
	let inputId = $state('');


	// For EVM accounts, always start with empty string. For Hive accounts, use SendTxDetails.toUsername
	let hiveAccount = $state('');
	let hiveAccountError = $state<string | undefined>(undefined);
	let isHiveAccountValid = $state(false);
	let hasInitialized = $state(false);
	
	// Sync hiveAccount with SendTxDetails only once when component opens
	$effect(() => {
		if (open && !hasInitialized) {
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
			hasInitialized = true;
		}
		if (!open) {
			hasInitialized = false;
		}
	});

	$effect(() => {
		if (!open) return;
		if (!$SendTxDetails.toCoin) return;
		if (shownCoin.coin.value === $SendTxDetails.toCoin.coin.value) {
			const amt = new CoinAmount(amount, $SendTxDetails.toCoin.coin).toAmountString();
			if (amt !== $SendTxDetails.toAmount)
				$SendTxDetails.toAmount = $SendTxDetails.fromAmount = amt;
		} else {
			new CoinAmount(amount, shownCoin.coin)
				.convertTo($SendTxDetails.toCoin.coin, Network.lightning)
				.then((amt) => {
					if ($SendTxDetails.toAmount !== amt.toAmountString()) {
						$SendTxDetails.toAmount = $SendTxDetails.fromAmount = amt.toAmountString();
					}
				});
		}
	});

	let toOptions = [
		{
			label: Coin.hive.label,
			value: Coin.hive.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hive,
				network: Network.magi
			}
		},
		{
			label: Coin.hbd.label,
			value: Coin.hbd.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hbd,
				network: Network.magi
			}
		}
	];

	const max = $derived.by(() => {
		const coin = $SendTxDetails.fromCoin?.coin;
		if (!coin) return;
		if ($accountBalance.bal && coin.value in $accountBalance.bal) {
			return new CoinAmount(
				$accountBalance.bal[coin.value as keyof typeof $accountBalance.bal],
				coin,
				true
			);
		}
	});

	const amountNumber = $derived(parseFloat(amount));
	
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
			hiveAccountError = 'EVM addresses are not supported for Hive Mainnet withdrawals. Please use a Hive username.';
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
			amountNumber > 0 &&
			amountNumber <= (max?.toNumber() ?? Number.MAX_SAFE_INTEGER)
		);
		
		if (auth.value?.provider === 'aioha') {
			// For Hive accounts, base validation is enough
			editStage(baseValidation);
		} else {
			// For EVM accounts, also require valid Hive account
			editStage(baseValidation && isHiveAccountValid && !!$SendTxDetails.toUsername);
		}
	});

	let possibleCoins: CoinOptions['coins'] = $derived.by(() => {
		let result: CoinOptions['coins'] = [{ coin: Coin.usd, networks: [] }];
		if ($SendTxDetails.toCoin) {
			result = [$SendTxDetails.toCoin, ...result];
		}
		return result;
	});
	let lastPossibleCoins: CoinOptions['coins'] = $state([]);
	$effect(() => {
		possibleCoins;
		untrack(() => {
			if (!open) return;
			if (
				!lastPossibleCoins.some((coinOpt) => coinOpt.coin.value !== Coin.usd.value) &&
				possibleCoins.some((coinOpt) => coinOpt.coin.value !== Coin.usd.value)
			) {
				shownIndex = possibleCoins.findIndex((coinOpt) => coinOpt.coin.value !== Coin.usd.value);
			} else {
				const index = possibleCoins.findIndex(
					(coinOpt) => coinOpt.coin.value === shownCoin.coin.value
				);
				if (index >= 0) {
					shownIndex = index;
				} else {
					if (shownIndex > possibleCoins.length - 1) {
						shownIndex = 0;
					}
				}
			}
			shownCoin = possibleCoins[shownIndex];
			lastPossibleCoins = possibleCoins;
		});
	});
	let shownIndex = $state(0);
	let shownCoin: CoinOptions['coins'][number] = $state(
		$SendTxDetails.toCoin ?? { coin: Coin.usd, networks: [] }
	);
	function cycleShown() {
		shownIndex = (shownIndex + 1) % possibleCoins.length;
		shownCoin = possibleCoins[shownIndex];
	}
</script>

{#snippet toOption(params: ComponentProps<typeof BalanceInfo>)}
	<BalanceInfo {...params} size="medium" />
{/snippet}

{#if auth.value?.provider === 'aioha'}
<div class="sections">
	<div class="section">
		<label for={inputId}>Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:amount
					coinOpt={shownCoin}
					network={$SendTxDetails.toNetwork}
					maxAmount={max}
					bind:id={inputId}
				/>
			</div>
			<span class="cycle-button">
				<PillButton onclick={cycleShown} styleType="icon">
					<ArrowRightLeft />
				</PillButton>
			</span>
		</div>
	</div>
	<div class="section dest-confirm">
		<div class="select">
			<span class="label-like">Withdraw Asset</span>
			<Select
				items={toOptions}
				initial={$SendTxDetails.toCoin?.coin.value}
				onValueChange={(details) => {
					if (open) {
						$SendTxDetails.toCoin = $SendTxDetails.fromCoin = swapOptions.to.coins.find(
							(coinOpt) => coinOpt.coin.value === details.value[0]
						);
					}
				}}
				styleType="dropdown"
				placeholder="Select Asset"
			/>
		</div>
	</div>
</div>
{:else} <!-- EVM accounts -->
<div class="sections">
	<div class="section">
		<span class="label-like">Hive Account</span>
		<ContactSearchBox
			bind:value={hiveAccount}
			enableContacts={false}
			placeholder="Enter Hive username"
		/>
		{#if hiveAccountError}
			<span class="error-message">{hiveAccountError}</span>
		{/if}
	</div>
	<div class="section">
		<label for={inputId}>Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:amount
					coinOpt={shownCoin}
					network={$SendTxDetails.toNetwork}
					maxAmount={max}
					bind:id={inputId}
				/>
			</div>
			<span class="cycle-button">
				<PillButton onclick={cycleShown} styleType="icon">
					<ArrowRightLeft />
				</PillButton>
			</span>
		</div>
	</div>
	<div class="section dest-confirm">
		<div class="select">
			<span class="label-like">Withdraw Asset</span>
			<Select
				items={toOptions}
				initial={$SendTxDetails.toCoin?.coin.value}
				onValueChange={(details) => {
					if (open) {
						$SendTxDetails.toCoin = $SendTxDetails.fromCoin = swapOptions.to.coins.find(
							(coinOpt) => coinOpt.coin.value === details.value[0]
						);
					}
				}}
				styleType="dropdown"
				placeholder="Select Asset"
			/>
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
		.cycle-button {
			:global(button) {
				margin: 0;
				margin-top: 2px;
			}
		}
	}
	.dest-confirm {
		display: flex;
		align-items: end;
		gap: 1rem;
		.select {
			flex-grow: 1;
			:global([data-scope='select'][data-part='control']) {
				height: 52px;
			}
		}
	}
	.error-message {
		color: var(--error-color, #ff4444);
		font-size: 0.875rem;
		margin-top: 0.5rem;
		display: block;
	}
</style>
