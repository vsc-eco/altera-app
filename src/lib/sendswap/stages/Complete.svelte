<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import moment from 'moment';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { goto } from '$app/navigation';
	import PieTimer from '$lib/components/PieTimer.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowDown, EqualApproximately } from '@lucide/svelte';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';

	let timer = $state<PieTimer>();

	let { txId, close }: { txId: string; close?: () => void } = $props();

	const isSend = $derived($SendTxDetails.toUsername !== getUsernameFromAuth(getAuth()()));

	let fromCoin = $derived($SendTxDetails.fromCoin?.coin ?? coins.unk);
	let toCoin = $derived($SendTxDetails.toCoin?.coin ?? coins.unk);
	let inUsd = $state('');
	$effect(() => {
		new CoinAmount($SendTxDetails.fromAmount, fromCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toMinFigs();
			});
	});
	let today = moment().format('MMM D, YYYY');

	function redirect() {
		const openTxParams = new URLSearchParams();
		openTxParams.set('tx', txId);
		openTxParams.set('index', '0');
		goto(`/transactions?${openTxParams.toString()}`);
	}

	let timerStarted = false;
	let timerCanceled = $state(false);
	function cancelTimer() {
		timer?.stop();
		timerCanceled = true;
	}
	$effect(() => {
		if (txId && !timerStarted) {
			timer?.start();
			timerStarted = true;
		}
		if (timerStarted && !txId) {
			timer?.stop();
			timerStarted = false;
			timerCanceled = false;
		}
	});
</script>

<div class="wrapper">
	<h2>Payment Complete</h2>
	<Card>
		<div class="amount">
			{#if isSend}
				<span class="sm-caption">Payment to {$SendTxDetails.toDisplayName}</span>
				<h4>
					{new CoinAmount($SendTxDetails.fromAmount, fromCoin).toPrettyString()}
					{`(\$US ${inUsd})`}
				</h4>
			{:else if $SendTxDetails.toNetwork && $SendTxDetails.fromNetwork}
				<div class="swap-header">
					<span class="from-icon">
						<CoinNetworkIcon coin={fromCoin} network={$SendTxDetails.fromNetwork!} size={32} />
					</span>
					<span class="from-amt">
						{new CoinAmount($SendTxDetails.fromAmount, fromCoin).toPrettyString()}
						<EqualApproximately size="16" />
						{`${inUsd} USD`}
					</span>
					<span class="arrow">
						<ArrowDown />
					</span>

					<span class="to-icon">
						<CoinNetworkIcon coin={toCoin} network={$SendTxDetails.toNetwork!} size={32} />
					</span>
					<span class="to-amt">
						{new CoinAmount($SendTxDetails.toAmount, toCoin).toPrettyString()}
					</span>
				</div>
			{/if}
		</div>
		<div class="date">
			<span>Paid on {today}</span>
		</div>
	</Card>
	{#if !timerCanceled}
		<div class="redirect">
			<p>Closing…</p>
			<PieTimer bind:this={timer} onComplete={close ?? redirect} />
			<PillButton onclick={cancelTimer}>Stay</PillButton>
		</div>
	{/if}
</div>

<style lang="scss">
	h4 {
		padding: 1.5rem 0;
		font-size: var(--text-6xl);
		// font-weight: 400;
		// color: var(--neutral-fg);
		margin: 0;
	}
	.date {
		padding: 1.5rem 0 1rem;
		border-top: 1px solid var(--neutral-bg-accent);
	}
	.sm-caption {
		color: var(--neutral-fg);
	}
	.redirect {
		margin-top: 2rem;
		display: flex;
		gap: 1rem;
		align-items: center;
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
