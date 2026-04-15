<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network, type CoinOnNetwork } from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import { validate, Network as BtcNetwork } from 'bitcoin-address-validation';

	let {
		editStage,
		open
	}: { editStage: (complete: boolean) => void; open: boolean } = $props();

	const auth = $derived(getAuth()());

	let coinAmount = $state(new CoinAmount(0, Coin.btc));
	let inputId = $state('');
	let btcAddress = $state('');
	let btcAddressError = $state<string | undefined>(undefined);
	let isBtcAddressValid = $state(false);
	let deductFee = $state(false);
	let maxFeeRaw = $state('');

	function onAddressInput(value: string) {
		btcAddress = value;
		if (!value) {
			isBtcAddressValid = false;
			btcAddressError = undefined;
		} else if (validate(value, BtcNetwork.mainnet)) {
			isBtcAddressValid = true;
			btcAddressError = undefined;
		} else {
			isBtcAddressValid = false;
			btcAddressError = 'Invalid Bitcoin mainnet address.';
		}
		SendTxDetails.update((d) => ({ ...d, toUsername: value }));
	}

	// Sync deductFee and maxFee into store
	$effect(() => {
		const maxFee = maxFeeRaw ? parseInt(maxFeeRaw) : undefined;
		SendTxDetails.update((d) => ({
			...d,
			btcDeductFee: deductFee,
			btcMaxFee: maxFee !== undefined && !isNaN(maxFee) ? maxFee : undefined
		}));
	});

	let max = $state(new CoinAmount(0, Coin.btc));
	$effect(() => {
		if (!open || !$SendTxDetails.fromCoin || !$SendTxDetails.fromNetwork) return;
		max = getBalanceAmount($accountBalance, $SendTxDetails.fromCoin.coin, $SendTxDetails.fromNetwork);
	});

	// Sync coinAmount → store
	let lastSyncedAmt = '';
	$effect(() => {
		if (!open) return;
		const amt = coinAmount.toAmountString();
		if (amt === lastSyncedAmt) return;
		lastSyncedAmt = amt;
		SendTxDetails.update((d) => ({ ...d, fromAmount: amt, toAmount: amt, enteredAmount: amt }));
	});

	// Signal stage completion
	$effect(() => {
		if (!open) return;
		const valid = !!(
			isBtcAddressValid &&
			$SendTxDetails.fromCoin &&
			$SendTxDetails.fromNetwork &&
			coinAmount.amount > 0 &&
			coinAmount.amount <= (max?.amount ?? Number.MAX_SAFE_INTEGER)
		);
		editStage(valid);
	});

	const coinOptions: CoinOnNetwork[] = $derived(
		$SendTxDetails.fromCoin && $SendTxDetails.fromNetwork
			? [{ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork }]
			: [{ coin: Coin.btc, network: Network.magi }]
	);
</script>

<div class="sections">
	<div class="section">
		<label for="btc-address">Bitcoin Address</label>
		<input
			id="btc-address"
			class="btc-address-input"
			type="text"
			placeholder="bc1q…"
			value={btcAddress}
			oninput={(e) => onAddressInput(e.currentTarget.value.trim())}
		/>
		{#if btcAddressError}
			<span class="error-message">{btcAddressError}</span>
		{/if}
	</div>
	<div class="section">
		<label for={inputId}>Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:coinAmount
					coinOpts={coinOptions}
					expressIn={$SendTxDetails.fromCoin?.coin ?? Coin.btc}
					maxAmount={max}
					bind:id={inputId}
				/>
			</div>
		</div>
	</div>
	<div class="section fee-options">
		<label class="checkbox-label">
			<input type="checkbox" bind:checked={deductFee} />
			<span>Deduct fee from amount</span>
		</label>
		<span class="hint">Fee is subtracted from your withdrawal instead of added on top</span>
		<details class="advanced">
			<summary>Advanced</summary>
			<div class="max-fee-field">
				<label for="max-fee">Max fee (sats)</label>
				<input
					id="max-fee"
					class="max-fee-input"
					type="number"
					min="0"
					placeholder="No limit"
					bind:value={maxFeeRaw}
				/>
				<span class="hint">Transaction reverts if total fee exceeds this amount</span>
			</div>
		</details>
	</div>
</div>

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.btc-address-input,
	.max-fee-input {
		width: 100%;
		box-sizing: border-box;
		background: var(--card-bg, transparent);
		border: 1px solid var(--border-color, #444);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		color: inherit;
		font-size: 1rem;
		&::placeholder {
			opacity: 0.4;
		}
		&:focus {
			outline: none;
			border-color: var(--dash-accent-blue, #4a9eff);
		}
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
	.fee-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}
	.hint {
		font-size: 0.8rem;
		opacity: 0.6;
	}
	.advanced {
		margin-top: 0.25rem;
		summary {
			cursor: pointer;
			font-size: 0.9rem;
			opacity: 0.7;
		}
	}
	.max-fee-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
		label {
			font-size: 0.9rem;
		}
	}
	.error-message {
		color: var(--dash-accent-red);
		font-size: 0.875rem;
		margin-top: 0.25rem;
		display: block;
	}
</style>
