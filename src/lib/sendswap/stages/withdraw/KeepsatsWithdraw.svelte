<script lang="ts">
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network, type CoinOnNetwork } from '$lib/sendswap/utils/sendOptions';
	import { getFee } from '$lib/sendswap/utils/sendUtils';
	import { useWithdrawState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import { untrack } from 'svelte';

	let { editStage, open }: { editStage: (complete: boolean) => void; open: boolean } = $props();

	const txState = useWithdrawState();

	let coinAmount: CoinAmount<Coin> = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	// Derived primitives from state
	const _fromCoinValue = $derived(txState.fromCoin?.coin?.value);
	const _toCoinValue = $derived(txState.toCoin?.coin?.value);
	const _fromNetwork = $derived(txState.fromNetwork?.value);
	const _toNetwork = $derived(txState.toNetwork?.value);
	const _toAmount = $derived(txState.toAmount);

	// Sync coinAmount → fromAmount, toAmount, fee atomically (following LightningDeposit pattern)
	$effect(() => {
		if (!open) return;
		const fromCoinVal = _fromCoinValue;
		const toCoinVal = _toCoinValue;
		if (!fromCoinVal) return;
		const amt = coinAmount.toAmountString();
		const coinVal = coinAmount.coin.value;
		const coinAmountSnapshot = coinAmount;
		untrack(() => {
			if (!txState.fromCoin) return;

			// Always preserve the raw user input as enteredAmount
			if (amt !== txState.enteredAmount) {
				txState.enteredAmount = amt;
			}

			// Compute fromAmount
			if (coinVal === fromCoinVal) {
				if (amt !== txState.fromAmount) {
					txState.fromAmount = amt;
				}
			} else {
				coinAmountSnapshot
					.convertTo(txState.fromCoin.coin, Network.lightning)
					.then((converted) => {
						const convertedAmt = converted.toAmountString();
						if (txState.fromAmount !== convertedAmt) {
							txState.fromAmount = convertedAmt;
						}
					});
			}

			// Compute toAmount
			if (!txState.toCoin || !toCoinVal) return;
			if (coinVal === toCoinVal) {
				if (amt !== txState.toAmount) {
					txState.toAmount = amt;
				}
				// Calculate fee based on toAmount
				getFee(amt, txState).then((fee) => {
					if (
						fee?.amount !== txState.fee?.amount ||
						fee?.coin.value !== txState.fee?.coin.value
					) {
						txState.fee = fee;
					}
				});
			} else {
				coinAmountSnapshot
					.convertTo(txState.toCoin.coin, Network.lightning)
					.then((converted) => {
						const convertedAmt = converted.toAmountString();
						if (txState.toAmount !== convertedAmt) {
							txState.toAmount = convertedAmt;
						}
						// Calculate fee based on converted toAmount
						getFee(convertedAmt, txState).then((fee) => {
							if (
								fee?.amount !== txState.fee?.amount ||
								fee?.coin.value !== txState.fee?.coin.value
							) {
								txState.fee = fee;
							}
						});
					});
			}
		});
	});

	// Get max balance in whatever coin is currently selected. SATS and BTC share
	// the same raw integer unit (satoshis), so balance.amount is valid for both —
	// only the coin wrapper changes, which is what AmountInput needs for showMax.
	let max = $state(new CoinAmount(0, Coin.sats));

	$effect(() => {
		if (!open || !txState.fromCoin || !txState.fromNetwork) return;
		if (coinAmount.coin.value === Coin.unk.value) return;
		const balance = getBalanceAmount($accountBalance, txState.fromCoin.coin, txState.fromNetwork);
		max = new CoinAmount(balance.amount, coinAmount.coin, true);
	});

	// Validation
	$effect(() => {
		if (!open) return;
		const hasCoins = !!_fromCoinValue && !!_toCoinValue;
		const hasNetwork = !!_fromNetwork;
		const amt = coinAmount.amount;
		const hasToAmount = !!_toAmount && _toAmount !== '0';
		untrack(() => {
			if (hasCoins && txState.fromAmount && hasNetwork && amt > 0 && hasToAmount) {
				editStage(true);
			} else {
				editStage(false);
			}
		});
	});

	// Coin options: BTC and SATS, with SATS sorted first (default)
	const coinOptions: CoinOnNetwork[] = $derived.by(() => {
		let result: CoinOnNetwork[] = [];
		const fCoin = _fromCoinValue;
		const fNet = _fromNetwork;
		if (fCoin && fNet && txState.fromCoin && txState.fromNetwork) {
			result.push({
				coin: txState.fromCoin.coin,
				network: txState.fromNetwork
			});
		}
		if (result.map((coinOpt) => coinOpt.coin.value).includes(Coin.btc.value)) {
			result.push({ coin: Coin.sats, network: Network.magi });
		}
		// Sort so SATS appears first (default selection)
		if (
			result.some((coinOpt) => coinOpt.coin.value === Coin.btc.value) &&
			result.some((coinOpt) => coinOpt.coin.value === Coin.sats.value)
		) {
			result = result.sort((a, b) =>
				a.coin.value === Coin.sats.value ? -1 : b.coin.value === Coin.sats.value ? 1 : 0
			);
		}
		return result;
	});

	// Initialize coinAmount to SATS by default
	$effect(() => {
		if (coinAmount.coin.value === Coin.unk.value && coinOptions.length > 0) {
			const defaultCoin = coinOptions[0].coin;
			coinAmount = new CoinAmount(0, defaultCoin);
		}
	});
</script>

<div class="sections">
	<div class="section">
		<div class="amount-header">
			<label for={inputId}>Amount</label>
		</div>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:coinAmount
					coinOpts={coinOptions}
					maxAmount={max}
					bind:id={inputId}
				/>
			</div>
		</div>
	</div>
	<div class="section fee-display">
		<label for="fee-display-info">Estimated Fee</label>
		<div id="fee-display-info" class="fee-info">
			{#if txState.fee}
				<span class="fee-amount">{txState.fee.toPrettyAmountString()} {txState.fee.coin.unit}</span>
			{:else}
				<span class="fee-loading">…</span>
			{/if}
		</div>
		<span class="hint">V4V Gateway fee based on conversion rate</span>
	</div>
</div>

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.amount-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
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
	.fee-display {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.fee-info {
			display: flex;
			align-items: center;
			gap: 1rem;
			padding: 0.75rem 1rem;
			background: var(--card-bg, transparent);
			border: 1px solid var(--border-color, #444);
			border-radius: 8px;
			min-height: 3rem;
			.fee-amount {
				font-size: 1rem;
				font-weight: 500;
			}
			.fee-loading {
				opacity: 0.5;
			}
		}
	}
	.hint {
		font-size: 0.875rem;
		opacity: 0.7;
	}
</style>
