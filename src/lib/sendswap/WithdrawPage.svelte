<!--
	Withdraw flow as a dedicated page (route: /withdraw).

	Page-layout sibling of Withdraw.svelte (the legacy modal). Same flow, same
	txState/broadcast wiring — the differences mirror DepositPage:
	  • renders StepsMachine with size="page" (no Dialog)
	  • "close" navigates home instead of toggling a dialog
	  • the options stage is the asset-first WithdrawTimeline; review + complete
	    render as modal dialogs over the page (the `popup` flag)
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import WithdrawTimeline from './stages/withdraw/WithdrawTimeline.svelte';
	import WithdrawSidebar from './stages/withdraw/WithdrawSidebar.svelte';
	import { WithdrawTxState, provideTxState } from './utils/txState.svelte';
	import Complete from './stages/Complete.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';

	const txState = new WithdrawTxState();
	provideTxState(txState);

	function applyWithdrawDetails() {
		txState.toUsername = '';
		txState.from = undefined;
		txState.to = undefined;
		txState.fromAmount = '0';
		txState.toAmount = '0';
		txState.fee = undefined;
		txState.deductFee = false;
		txState.maxFee = undefined;
	}

	// Page is always "open": initialise once at mount (parallel to DepositPage).
	applyWithdrawDetails();

	function leave() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static root navigation; resolve() not exported in this kit version
		goto('/');
	}

	const stepsData: MixedStepsArray = [
		{ value: 'options', component: WithdrawTimeline },
		{ value: 'review', component: ReviewSwap, popup: true },
		{ value: 'complete', component: Complete, popup: true }
	];

	let extraProps = $derived({
		close: leave,
		onClose: leave,
		compact: false
	});
</script>

<div class="withdraw-page-wrapper">
	<div class="withdraw-layout">
		<div class="withdraw-flow-col">
			<StepsMachine
				size="page"
				txType="withdraw"
				resetState={applyWithdrawDetails}
				{stepsData}
				{extraProps}
			/>
		</div>
		<aside class="withdraw-rail-col">
			<WithdrawSidebar />
		</aside>
	</div>
</div>

<style lang="scss">
	.withdraw-page-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.withdraw-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 4rem;
		max-width: 66rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		width: 100%;
	}
	.withdraw-flow-col {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.withdraw-rail-col {
		min-width: 0;
	}
	@media (max-width: 1440px) {
		.withdraw-layout {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 720px) {
		.withdraw-layout {
			padding: 1.25rem 1rem 3rem;
		}
	}
</style>
