<!--
	Deposit flow as a dedicated page (route: /deposit).

	Page-layout sibling of Deposit.svelte (the legacy modal). Same flow,
	same txState/broadcast wiring — the only differences are:
	  • renders StepsMachine with size="page" (no Dialog, no shrinking)
	  • "close" navigates home instead of toggling a dialog
	The BTC receipt popup stays a small dialog: it's a transient
	confirmation, not the deposit surface, so it's fine as an overlay.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import DepositTimeline from './stages/deposit/DepositTimeline.svelte';
	import DepositSidebar from './stages/deposit/DepositSidebar.svelte';
	import { Coin } from './utils/sendOptions';
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
	import Dialog from '$lib/zag/Dialog.svelte';

	const auth = $derived(getAuth()());

	const txState = new DepositTxState();
	provideTxState(txState);

	function applyDepositDetails() {
		txState.toUsername = getUsernameFromAuth(auth) ?? '';
		txState.from = undefined;
		txState.to = undefined;
		txState.fromAmount = '0';
		txState.toAmount = '0';
		txState.fee = undefined;
	}

	// Page is always "open": initialise once at mount (parallel to SendSwap).
	applyDepositDetails();

	$effect(() => {
		if (!auth) return;
		const username = getUsernameFromAuth(auth);
		if (username && username !== txState.toUsername) {
			txState.toUsername = username;
		}
	});

	function leave() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static root navigation; resolve() not exported in this kit version
		goto('/');
	}

	const stepsData: MixedStepsArray = [
		{ value: 'options', component: DepositTimeline },
		// review + complete render as modal dialogs over the page (the
		// `popup` flag makes these stages wrap themselves in a Dialog —
		// same mechanism the /swap flow uses), so the deposit page (flow +
		// recent-deposits rail) stays visible behind them.
		{ value: 'review', component: ReviewSwap, popup: true },
		{ value: 'complete', component: Complete, popup: true }
	];

	// Receipt popup — shown after a successful BTC wallet broadcast.
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
		close: leave,
		onClose: leave,
		onBroadcast: onBtcBroadcast,
		compact: false
	});
</script>

<div class="deposit-page-wrapper">
	<div class="deposit-layout">
		<div class="deposit-flow-col">
			<StepsMachine
				size="page"
				txType="deposit"
				resetState={applyDepositDetails}
				{stepsData}
				{extraProps}
			/>
		</div>
		<aside class="deposit-rail-col">
			<DepositSidebar />
		</aside>
	</div>
</div>

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
	.deposit-page-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	/* Two columns at the page level: the deposit flow (with its NavButtons
	   rendered directly beneath it) and the recent-deposits + FAQ rail. */
	.deposit-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		/* Generous horizontal gap on wide layouts so the flow column and the
		   FAQ rail clearly read as separate concerns. When the layout
		   collapses to a single column (≤1440px), the same value works as the
		   VERTICAL gap between flow and rail stacked below. */
		gap: 4rem;
		max-width: 66rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		width: 100%;
	}
	.deposit-flow-col {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.deposit-rail-col {
		min-width: 0;
	}
	@media (max-width: 1440px) {
		.deposit-layout {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 720px) {
		.deposit-layout {
			padding: 1.25rem 1rem 3rem;
		}
	}
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
