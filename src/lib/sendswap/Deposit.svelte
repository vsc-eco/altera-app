<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import DepositOptions from './stages/deposit/DepositOptions.svelte';
	import { Coin, Network } from './utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { DepositTxState, provideTxState } from './utils/txState.svelte';
	import Complete from './stages/Complete.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Card from '$lib/cards/Card.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import PieTimer from '$lib/components/PieTimer.svelte';

	let {
		dialogOpen = $bindable(),
		toggle = $bindable(),
		sessionId
	}: {
		dialogOpen: boolean;
		toggle: (open?: boolean) => void;
		sessionId: number;
	} = $props();

	const auth = $derived(getAuth()());

	const txState = new DepositTxState();
	provideTxState(txState);

	function applyDepositDetails() {
		txState.toNetwork = Network.magi;
		txState.toUsername = getUsernameFromAuth(auth) ?? '';
		txState.fromCoin = undefined;
		txState.fromNetwork = undefined;
		txState.toCoin = undefined;
		txState.fromAmount = '0';
		txState.toAmount = '0';
		txState.enteredAmount = '0';
		txState.fee = undefined;
		txState.account = undefined;
	}

	$effect(() => {
		if (!dialogOpen) return;
		sessionId;
		applyDepositDetails();
	});
	$effect(() => {
		if (!auth || !dialogOpen) return;
		const username = getUsernameFromAuth(auth);
		if (username && username !== txState.toUsername) {
			txState.toUsername = username;
		}
	});

	// STEPS
	const stepsData: MixedStepsArray = [
		{ value: 'options', component: DepositOptions },
		{ value: 'review', component: ReviewSwap },
		{ value: 'complete', component: Complete }
	];

	// Receipt popup state — shown after a successful BTC wallet
	// broadcast. Lives here in Deposit.svelte (not inside the
	// BitcoinMainnetDeposit stage) so closing the parent deposit
	// dialog doesn't unmount it mid-render.
	let receiptOpen = $state(false);
	let receiptToggle = $state<(open?: boolean) => void>(() => {});
	let receiptTxHash = $state<string | null>(null);
	let receiptAmount = $state<CoinAmount<typeof Coin.btc> | null>(null);
	let receiptTimer = $state<PieTimer>();
	let receiptTimerStarted = $state(false);
	let receiptTimerCanceled = $state(false);

	$effect(() => {
		if (receiptOpen && receiptTimer && !receiptTimerStarted) {
			receiptTimer.start();
			receiptTimerStarted = true;
		}
		if (!receiptOpen && receiptTimerStarted) {
			receiptTimer?.stop();
			receiptTimerStarted = false;
			receiptTimerCanceled = false;
		}
	});

	function cancelReceiptTimer() {
		receiptTimer?.stop();
		receiptTimerCanceled = true;
	}
	function handleReceiptTimerComplete() {
		receiptToggle(false);
	}

	function onBtcBroadcast(info: {
		txHash: string;
		amount: CoinAmount<typeof Coin.btc>;
		address: string;
	}) {
		receiptTxHash = info.txHash;
		receiptAmount = info.amount;
		receiptTimerCanceled = false;
		receiptToggle(true);
	}

	let extraProps = $derived({
		close: toggle,
		onClose: toggle,
		onBroadcast: onBtcBroadcast,
		compact: true
	});
</script>

<Dialog bind:toggle bind:open={dialogOpen}>
	{#snippet content()}
		{#if dialogOpen}
			<StepsMachine
				size="dialog"
				txType="deposit"
				resetState={applyDepositDetails}
				{stepsData}
				{extraProps}
				minHeight={512}
			/>
		{/if}
	{/snippet}
</Dialog>

<Dialog bind:open={receiptOpen} bind:toggle={receiptToggle}>
	{#snippet title()}Broadcast Submitted{/snippet}
	{#snippet content()}
		<div class="receipt-body">
			<Card>
				<div class="receipt-amount">
					<span class="sm-caption">Sent to mapping address</span>
					<h4>{receiptAmount ? receiptAmount.toPrettyAmountString() : '0'} BTC</h4>
				</div>
				{#if receiptTxHash}
					<div class="receipt-tx">
						<span class="receipt-label">Transaction</span>
						<Clipboard value={receiptTxHash} label="Transaction hash" disabled={false} />
					</div>
				{/if}
				<div class="receipt-hint">
					<span
						>Your Bitcoin transaction has been broadcast. Mapped BTC will appear in your Magi
						account once the mapping bot observes the tx (typically ~30 minutes).</span
					>
				</div>
			</Card>
			{#if !receiptTimerCanceled}
				<div class="receipt-redirect">
					<p>Closing…</p>
					<PieTimer bind:this={receiptTimer} onComplete={handleReceiptTimerComplete} />
					<PillButton onclick={cancelReceiptTimer}>Stay</PillButton>
				</div>
			{/if}
			<div class="popup-buttons">
				<PillButton onclick={() => receiptToggle(false)} theme="accent" styleType="invert"
					>Done</PillButton
				>
			</div>
		</div>
	{/snippet}
</Dialog>

<style lang="scss">
	.receipt-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 22rem;
		max-width: 30rem;
	}
	.receipt-amount {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-bottom: 0.75rem;
	}
	.receipt-amount h4 {
		font-size: var(--text-4xl);
		margin: 0;
	}
	.receipt-tx {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--dash-card-border);
	}
	.receipt-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--dash-text-muted);
	}
	.receipt-hint {
		color: var(--dash-text-muted);
		font-size: 0.75rem;
		line-height: 1.4;
		padding-top: 0.75rem;
		border-top: 1px solid var(--dash-card-border);
		margin-top: 0.5rem;
	}
	.receipt-redirect {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 0 0.25rem;
	}
	.popup-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 1rem;
		margin-top: 0.5rem;
		border-top: 1px solid var(--dash-card-border);
	}
</style>
