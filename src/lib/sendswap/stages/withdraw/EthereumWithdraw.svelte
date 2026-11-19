<script lang="ts">
	// ETH / USDC on Magi -> an Ethereum address (the EVM bridge's unmapETH /
	// unmapERC20). The BitcoinMainnetWithdraw flow with an Ethereum address:
	// the bridge itself refuses a vault or zero-address destination, and the
	// dry run in sendUtils shows its reason before anything is signed.
	import { getAuth } from '$lib/auth/store';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network, type CoinOnNetwork } from '$lib/sendswap/utils/sendOptions';
	import { useWithdrawState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance, evmProofFee, getBalanceAmount } from '$lib/stores/currentBalance';
	import { maxSendableSats } from '$lib/stores/btcSpendable';
	import { isAddress } from 'viem';

	let { editStage, open }: { editStage: (complete: boolean) => void; open: boolean } = $props();

	const txState = useWithdrawState();
	const auth = $derived(getAuth()());

	const assetCoin = $derived(txState.from?.coin ?? Coin.eth);
	let coinAmount = $state(new CoinAmount(0, Coin.eth));
	let inputId = $state('');
	let ethAddress = $state('');
	let ethAddressError = $state<string | undefined>(undefined);
	let isEthAddressValid = $state(false);
	let previousOpen: boolean | undefined;

	// Autofill the address when the user is logged in with an Ethereum wallet.
	$effect(() => {
		if (!open || open === previousOpen) return;
		previousOpen = open;
		if (auth.value?.did?.startsWith('did:pkh:eip155:') && auth.value?.address && !ethAddress) {
			onAddressInput(auth.value.address);
		}
	});

	// The bridge charges its Ethereum gas fee in the withdrawn asset; taking it
	// from the amount lets "max" go through.
	let deductFee = $state(true);

	// Its proving fee is charged on top either way (prooffee.go), so max leaves
	// room for it, as the BTC max leaves the miner fee (maxSendableSats).
	const proofFee = $derived(
		assetCoin.value === Coin.usdc.value ? $evmProofFee.usdc : $evmProofFee.eth
	);
	const proofFeeText = $derived(
		(proofFee / 10 ** assetCoin.decimalPlaces).toLocaleString(undefined, {
			maximumFractionDigits: 6
		}) + ` ${assetCoin.label}`
	);
	const feeHint = $derived(
		"The bridge's Ethereum gas fee is taken from the withdrawal instead of added on top. " +
			(proofFee > 0 ? `Its proving fee (${proofFeeText}) is charged on top either way. ` : '') +
			'Paid out after Ethereum finality (~20 min).'
	);

	function onAddressInput(value: string) {
		ethAddress = value;
		if (!value) {
			isEthAddressValid = false;
			ethAddressError = undefined;
		} else if (isAddress(value)) {
			isEthAddressValid = true;
			ethAddressError = undefined;
		} else {
			isEthAddressValid = false;
			ethAddressError = 'Invalid Ethereum address.';
		}
		txState.toUsername = value;
	}

	$effect(() => {
		txState.deductFee = deductFee;
		txState.maxFee = undefined;
	});

	let max = $state(new CoinAmount(0, Coin.eth));
	$effect(() => {
		if (!open || !txState.from) return;
		const balance = getBalanceAmount($accountBalance, txState.from.coin, txState.from.network);
		max = new CoinAmount(maxSendableSats(balance.amount, proofFee), balance.coin, true);
	});

	// Sync coinAmount -> state
	let lastSyncedAmt = '';
	$effect(() => {
		if (!open) return;
		const amt = coinAmount.toAmountString();
		if (amt === lastSyncedAmt) return;
		lastSyncedAmt = amt;
		txState.fromAmount = amt;
		txState.toAmount = amt;
	});

	// Signal stage completion
	$effect(() => {
		if (!open) return;
		const valid = !!(
			isEthAddressValid &&
			txState.from &&
			coinAmount.amount > 0 &&
			coinAmount.amount <= (max?.amount ?? Number.MAX_SAFE_INTEGER)
		);
		editStage(valid);
	});

	const coinOptions: CoinOnNetwork[] = $derived(
		txState.from ? [txState.from] : [{ coin: assetCoin, network: Network.magi }]
	);
</script>

<div class="sections">
	<div class="section">
		<label for="eth-address">Ethereum Address</label>
		<input
			id="eth-address"
			class="eth-address-input"
			type="text"
			placeholder="0x…"
			value={ethAddress}
			oninput={(e) => onAddressInput(e.currentTarget.value.trim())}
		/>
		{#if ethAddressError}
			<span class="error-message">{ethAddressError}</span>
		{/if}
	</div>
	<div class="section">
		<label for={inputId}>Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:coinAmount
					coinOpts={coinOptions}
					expressIn={assetCoin}
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
		<span class="hint">{feeHint}</span>
	</div>
</div>

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.eth-address-input {
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
	.error-message {
		color: var(--dash-accent-red);
		font-size: 0.875rem;
		margin-top: 0.25rem;
		display: block;
	}
</style>
