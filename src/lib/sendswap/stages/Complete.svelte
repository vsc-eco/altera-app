<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import moment from 'moment';
	import { useTxState } from '$lib/sendswap/utils/txState.svelte';
	import { goto } from '$app/navigation';
	import PieTimer from '$lib/components/PieTimer.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowDown, EqualApproximately } from '@lucide/svelte';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { getHiveAssetName, getHbdAssetName } from '$lib/../client';
	import { numberFormatLanguage } from '$lib/constants';
	import {
		ALTERA_FEE_BPS,
		ALTERA_FEE_USD_THRESHOLD
	} from '$lib/magiTransactions/hive/vscOperations/swap';

	const txState = useTxState();

	let timer = $state<PieTimer>();

	let {
		txId,
		onClose = redirect,
		popup = false,
		isActive = false,
		previous,
		next,
		goHome
	}: {
		txId: string;
		onClose?: () => void;
		popup?: boolean;
		isActive?: boolean;
		previous?: () => void;
		next?: () => void;
		goHome?: () => void;
	} = $props();

	// Drive the popup Dialog open/close from this stage's active state. Use
	// a previous-value tracker so dismissing doesn't immediately reopen.
	let dialogOpen = $state(false);
	let dialogToggle = $state<(o?: boolean) => void>(() => {});
	let lastIsActive = false;
	let lastDialogOpen = false;
	$effect(() => {
		if (!popup) return;
		if (isActive !== lastIsActive) {
			lastIsActive = isActive;
			dialogToggle?.(isActive);
			lastDialogOpen = isActive;
		}
	});
	// Dialog dismissed (X / backdrop / Esc / "Done" button) — reset
	// the steps machine to the home step so the parent NavButtons
	// re-appear.
	$effect(() => {
		if (!popup) return;
		if (dialogOpen === lastDialogOpen) return;
		lastDialogOpen = dialogOpen;
		if (!dialogOpen && isActive) {
			goHome?.();
		}
	});

	const isSend = $derived(txState.toUsername !== getUsernameFromAuth(getAuth()()));

	let fromCoin = $derived(txState.fromCoin?.coin ?? coins.unk);
	let toCoin = $derived(txState.toCoin?.coin ?? coins.unk);
	function prettyWithDisplayUnit(amt: CoinAmount<Coin>): string {
		const isNegative = amt.amount < 0;
		const n = Math.abs(amt.amount) / 10 ** amt.coin.decimalPlaces;
		const formatter = new Intl.NumberFormat(numberFormatLanguage, {
			useGrouping: true,
			minimumFractionDigits: amt.coin.decimalPlaces
		});
		const unit =
			amt.coin.value === Coin.hive.value
				? getHiveAssetName()
				: amt.coin.value === Coin.hbd.value
					? getHbdAssetName()
					: amt.coin.unit;
		return `${isNegative ? '-' : ''}${formatter.format(n)} ${unit}`;
	}
	let inUsd = $state('');
	let grossInUsdNum = $state(0);
	$effect(() => {
		new CoinAmount(txState.fromAmount, fromCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toMinFigs();
				grossInUsdNum = amount.toNumber();
			});
	});
	const alteraFeeApplies = $derived(
		!!txState.toNetwork &&
			txState.toNetwork.value !== Network.magi.value &&
			toCoin.value !== Coin.hive.value &&
			toCoin.value !== Coin.hbd.value &&
			grossInUsdNum >= ALTERA_FEE_USD_THRESHOLD
	);
	const alteraFeeAmount = $derived.by(() => {
		if (!alteraFeeApplies) return undefined;
		const out = new CoinAmount(txState.toAmount, toCoin);
		const feeSmallest = Math.floor((out.amount * ALTERA_FEE_BPS) / 10000);
		if (feeSmallest <= 0) return undefined;
		return new CoinAmount(feeSmallest, toCoin, true);
	});
	let today = moment().format('MMM D, YYYY');

	function redirect() {
		// No-op default — deposit/withdraw pass their own onClose
		// (dialog toggle) via extraProps; the /swap page's SendSwap
		// passes its own close handler too. Only the standalone
		// /transfer page would hit this default, and staying on the
		// current page is better than jumping to /transactions.
	}

	let timerStarted = false;
	let timerCanceled = $state(false);
	function cancelTimer() {
		timer?.stop();
		timerCanceled = true;
	}
	// When the auto-close timer completes, close the popup dialog first
	// (so the user sees it dismiss cleanly) and then run onClose, which by
	// default navigates to /transactions.
	function handleTimerComplete() {
		if (popup) dialogToggle?.(false);
		onClose();
	}
	$effect(() => {
		// Only mark started once the timer instance is actually bound.
		// In popup mode the timer lives inside a Dialog content snippet that
		// mounts after the effect first runs (when txId arrives), so without
		// the `timer` guard we'd flip timerStarted true on a no-op start and
		// never start the real timer when it later mounts.
		if (txId && !timerStarted && timer) {
			timer.start();
			timerStarted = true;
		}
		if (timerStarted && !txId) {
			timer?.stop();
			timerStarted = false;
			timerCanceled = false;
		}
	});
</script>

{#snippet completeBody()}
	<Card>
		<div class="amount">
			{#if isSend}
				<span class="sm-caption">Payment to {txState.kind === 'transfer' ? txState.toDisplayName : txState.toUsername}</span>
				<h4>
					{prettyWithDisplayUnit(new CoinAmount(txState.fromAmount, fromCoin))}
					{`(\$US ${inUsd})`}
				</h4>
			{:else if txState.toNetwork && txState.fromNetwork}
				<div class="swap-header">
					<span class="from-icon">
						<CoinNetworkIcon coin={fromCoin} network={txState.fromNetwork!} size={32} />
					</span>
					<span class="from-amt">
						{prettyWithDisplayUnit(new CoinAmount(txState.fromAmount, fromCoin))}
						<EqualApproximately size="16" />
						{`${inUsd} USD`}
					</span>
					<span class="arrow">
						<ArrowDown />
					</span>

					<span class="to-icon">
						<CoinNetworkIcon coin={toCoin} network={txState.toNetwork!} size={32} />
					</span>
					<span class="to-amt">
						{prettyWithDisplayUnit(new CoinAmount(txState.toAmount, toCoin))}
					</span>
				</div>
			{/if}
		</div>
		{#if alteraFeeAmount}
			<div class="altera-fee">
				<span class="sm-caption">Altera Fee ({(ALTERA_FEE_BPS / 100).toFixed(2)}%)</span>
				<span class="content">{prettyWithDisplayUnit(alteraFeeAmount)}</span>
			</div>
		{/if}
		<div class="date">
			<span>Paid on {today}</span>
		</div>
	</Card>
	{#if !timerCanceled}
		<div class="redirect">
			<p>Closing…</p>
			<PieTimer bind:this={timer} onComplete={handleTimerComplete} />
			<PillButton onclick={cancelTimer}>Stay</PillButton>
		</div>
	{/if}
{/snippet}

{#if popup}
	<Dialog bind:open={dialogOpen} bind:toggle={dialogToggle}>
		{#snippet title()}
			Payment Complete
		{/snippet}
		{#snippet content()}
			{@render completeBody()}
			<div class="popup-buttons">
				<PillButton onclick={() => { dialogToggle?.(false); onClose(); }} theme="accent" styleType="invert">Done</PillButton>
			</div>
		{/snippet}
	</Dialog>
{:else}
	<div class="wrapper">
		<h2>Payment Complete</h2>
		{@render completeBody()}
	</div>
{/if}

<style lang="scss">
	h4 {
		padding: 1.5rem 0;
		font-size: var(--text-6xl);
		// font-weight: 400;
		// color: var(--neutral-fg);
		margin: 0;
	}
	.altera-fee {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0 1rem;
		color: var(--mid);
	}
	.date {
		padding: 1.5rem 0 1rem;
		border-top: 1px solid var(--dash-card-border);
	}
	.sm-caption {
		color: var(--dash-text-primary);
	}
	.redirect {
		margin-top: 2rem;
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	.popup-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 1rem;
		margin-top: 1rem;
		border-top: 1px solid var(--dash-card-border);
	}
	.swap-header {
		padding-bottom: 0.5rem;
		display: grid;
		grid-template-columns: auto 1fr; /* Two columns: 1fr for image, 1fr for text */
		grid-template-rows: auto auto auto; /* Two rows for the text */
		gap: 0.25rem 1rem;
		grid-template-areas:
			'from-icon from-amt'
			'arrow .'
			'to-icon to-amt';
		.from-icon {
			grid-area: from-icon;
		}
		.from-amt {
			grid-area: from-amt;
		}
		.arrow {
			grid-area: arrow;
			text-align: center;
		}
		.to-icon {
			grid-area: to-icon;
		}
		.to-amt {
			grid-area: to-amt;
		}
		.from-amt,
		.to-amt {
			display: flex;
			align-items: center;
		}
	}
</style>
