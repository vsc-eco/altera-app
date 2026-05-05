<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network, type CoinOnNetwork } from '$lib/sendswap/utils/sendOptions';
	import { useWithdrawState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import { validate, Network as BtcNetwork } from 'bitcoin-address-validation';
	import {
		estimateBtcUnmapFee,
		type BtcFeeEstimate
	} from '$lib/magiTransactions/bitcoin/btcFeeEstimate';
	import { numberFormatLanguage } from '$lib/constants';

	let { editStage, open }: { editStage: (complete: boolean) => void; open: boolean } = $props();

	const txState = useWithdrawState();
	const auth = $derived(getAuth()());

	let coinAmount = $state(new CoinAmount(0, Coin.btc));
	let inputId = $state('');
	let btcAddress = $state('');
	let btcAddressError = $state<string | undefined>(undefined);
	let isBtcAddressValid = $state(false);
	let previousOpen: boolean | undefined;

	// Autofill BTC address when the user is logged in with a Bitcoin wallet
	$effect(() => {
		if (!open || open === previousOpen) return;
		previousOpen = open;
		if (auth.value?.did?.startsWith('did:pkh:bip122:') && auth.value?.address && !btcAddress) {
			onAddressInput(auth.value.address);
		}
	});

	let deductFee = $state(false);
	let maxFeeRaw = $state('');
	let btcFeeEstimate = $state<BtcFeeEstimate | null>(null);
	$effect(() => {
		if (!open) return;
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
		txState.toUsername = value;
	}

	// Sync deductFee and maxFee into state
	$effect(() => {
		const maxFee = maxFeeRaw ? parseInt(maxFeeRaw) : undefined;
		txState.btcDeductFee = deductFee;
		txState.btcMaxFee = maxFee !== undefined && !isNaN(maxFee) ? maxFee : undefined;
	});

	let max = $state(new CoinAmount(0, Coin.btc));
	$effect(() => {
		if (!open || !txState.fromCoin || !txState.fromNetwork) return;
		max = getBalanceAmount(
			$accountBalance,
			txState.fromCoin.coin,
			txState.fromNetwork
		);
	});

	// Sync coinAmount → state
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

	// Signal stage completion
	$effect(() => {
		if (!open) return;
		const valid = !!(
			isBtcAddressValid &&
			txState.fromCoin &&
			txState.fromNetwork &&
			coinAmount.amount > 0 &&
			coinAmount.amount <= (max?.amount ?? Number.MAX_SAFE_INTEGER)
		);
		editStage(valid);
	});

	const coinOptions: CoinOnNetwork[] = $derived(
		txState.fromCoin && txState.fromNetwork
			? [{ coin: txState.fromCoin.coin, network: txState.fromNetwork }]
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
					expressIn={txState.fromCoin?.coin ?? Coin.btc}
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
		<div class="fee-row">
			<div class="fee-field">
				<label for="estimated-fee">Estimated Fee</label>
				<div id="estimated-fee" class="fee-display">
					{#if btcFeeEstimate}
						~{formatSats(btcFeeEstimate.minSats)} – {formatSats(btcFeeEstimate.maxSats)} sats
					{:else}
						…
					{/if}
				</div>
				<span class="hint">Approximate network fee at the current base rate</span>
			</div>
			<div class="fee-field">
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
		</div>
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
		input {
			height: auto;
		}
	}
	.hint {
		font-size: 0.8rem;
		opacity: 0.6;
	}
	.fee-row {
		display: flex;
		gap: 1rem;
		margin-top: 0.75rem;
	}
	.fee-field {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		label {
			font-size: 0.9rem;
		}
	}
	.fee-display {
		width: 100%;
		box-sizing: border-box;
		background: var(--card-bg, transparent);
		border: 1px solid var(--border-color, #444);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		color: inherit;
		font-size: 1rem;
		opacity: 0.85;
	}
	.error-message {
		color: var(--dash-accent-red);
		font-size: 0.875rem;
		margin-top: 0.25rem;
		display: block;
	}
</style>
