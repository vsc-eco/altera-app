<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network, TransferMethod } from '$lib/sendswap/utils/sendOptions';
	import moment from 'moment';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { Dot, EqualApproximately, X } from '@lucide/svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import TxStatus from '../components/shared/TxStatus.svelte';
	import { getHiveAssetName, getHbdAssetName } from '../../../client';
	import { numberFormatLanguage } from '$lib/constants';

	const auth = $derived(getAuth()());
	let {
		editStage = () => {},
		isActive = true,
		status,
		waiting = false,
		abort = () => {},
		next,
		previous
	}: {
		editStage?: (complete: boolean) => void;
		isActive?: boolean;
		status: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
		next?: () => void;
		previous?: () => void;
	} = $props();

	// Mark the review stage as "complete" (user can proceed) as soon as it
	// becomes the active stage. The user clicking the forward button is then
	// what triggers the actual broadcast.
	$effect(() => {
		if (isActive) editStage(true);
	});

	// Drive the popup Dialog open/close from the stage's active state. Use
	// a previous-value tracker so that if the user dismisses the dialog
	// (Esc / X), we don't immediately reopen it on the next effect run.
	let dialogOpen = $state(false);
	let dialogToggle = $state<(o?: boolean) => void>(() => {});
	let lastIsActive = false;
	$effect(() => {
		if (isActive !== lastIsActive) {
			lastIsActive = isActive;
			dialogToggle?.(isActive);
		}
	});

	let toCoin = $derived($SendTxDetails.toCoin?.coin ?? Coin.unk);
	let fromCoin = $derived($SendTxDetails.fromCoin?.coin ?? Coin.unk);
	let effectiveFromAmount = $derived(
		$SendTxDetails.fromAmount && $SendTxDetails.fromAmount !== '0'
			? $SendTxDetails.fromAmount
			: $SendTxDetails.enteredAmount
	);
	let effectiveToAmount = $derived(
		$SendTxDetails.toAmount && $SendTxDetails.toAmount !== '0'
			? $SendTxDetails.toAmount
			: $SendTxDetails.enteredAmount
	);
	// When from/to coins differ, the enteredAmount fallback is in the wrong denomination.
	// Compute the converted "to" amount reactively so it displays correctly.
	let convertedToAmount = $state<CoinAmount<Coin> | undefined>();
	$effect(() => {
		const toAmt = $SendTxDetails.toAmount;
		if (toAmt && toAmt !== '0') {
			convertedToAmount = new CoinAmount(toAmt, toCoin);
			return;
		}
		// toAmount not yet available — convert from the entered amount
		const entered = $SendTxDetails.enteredAmount;
		if (!entered || entered === '0' || fromCoin.value === toCoin.value) {
			convertedToAmount = new CoinAmount(entered || '0', toCoin);
			return;
		}
		// Different coins: convert fromCoin → toCoin
		new CoinAmount(entered, fromCoin)
			.convertTo(toCoin, Network.lightning)
			.then((converted) => {
				// Only use if toAmount still not set
				const current = $SendTxDetails.toAmount;
				if (!current || current === '0') {
					convertedToAmount = converted;
				}
			});
	});
	const fromCoinDisplayLabel = $derived(
		fromCoin.value === Coin.hive.value ? getHiveAssetName() : fromCoin.value === Coin.hbd.value ? getHbdAssetName() : fromCoin.label
	);
	const toCoinDisplayLabel = $derived(
		toCoin.value === Coin.hive.value ? getHiveAssetName() : toCoin.value === Coin.hbd.value ? getHbdAssetName() : toCoin.label
	);
	/** Format amount with display unit (TESTS/TBD) for hive/hbd, else use coin.unit */
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
	/** Like toPrettyMinFigs but with display unit for hive/hbd */
	function prettyMinFigsWithDisplayUnit(amt: CoinAmount<Coin>, figures?: number, decimals?: number): string {
		const isNegative = amt.amount < 0;
		const n = Math.abs(amt.amount) / 10 ** amt.coin.decimalPlaces;
		const dec = decimals ?? amt.coin.decimalPlaces;
		const minFigs = n < 1 ? Math.min(amt.coin.decimalPlaces, figures ?? dec + 1) : (figures ?? dec + 1);
		const formatter = new Intl.NumberFormat(numberFormatLanguage, {
			useGrouping: true,
			minimumSignificantDigits: minFigs,
			minimumFractionDigits: dec,
			maximumSignificantDigits: 21
		});
		const unit =
			amt.coin.value === Coin.hive.value
				? getHiveAssetName()
				: amt.coin.value === Coin.hbd.value
					? getHbdAssetName()
					: amt.coin.unit;
		return `${isNegative ? '-' : ''}${formatter.format(n)} ${unit}`;
	}
	let inUsd = $state<CoinAmount<Coin>>();
	let feeInUsd = $state<CoinAmount<Coin>>();
	let total = $derived(
		!$SendTxDetails.fee
			? new CoinAmount(effectiveFromAmount, fromCoin)
			: new CoinAmount(effectiveFromAmount, fromCoin).add($SendTxDetails.fee)
	);
	let fromInTo = $state<CoinAmount<Coin>>();
	$effect(() => {
		if (!$SendTxDetails.fromCoin || !$SendTxDetails.toCoin) return;
		new CoinAmount(1, $SendTxDetails.fromCoin.coin)
			.convertTo($SendTxDetails.toCoin.coin, Network.lightning)
			.then((amt) => {
				fromInTo = amt;
			});
	});
	let isInstructions = $derived(
		auth.value?.provider === 'reown' &&
			$SendTxDetails.fromNetwork?.value === Network.hiveMainnet.value
	);
	$effect(() => {
		new CoinAmount(effectiveFromAmount, fromCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amt) => {
				inUsd = amt;
			});
	});
	$effect(() => {
		$SendTxDetails.fee?.convertTo(Coin.usd, Network.lightning).then((amount) => {
			feeInUsd = amount;
		});
	});
	let today = moment().format('MMM D, YYYY');
</script>

<Dialog bind:open={dialogOpen} bind:toggle={dialogToggle}>
	{#snippet title()}
		Review Swap
	{/snippet}
	{#snippet content()}
<div class="stacked-cards">
	<div class="line-positioner">
		<Card>
			<svg class="dashed-line">
				<line
					x1="1px"
					x2="1px"
					y1="15%"
					y2="85%"
					stroke="var(--dash-card-border)"
					stroke-width="2"
					stroke-dasharray="5,5"
				/>
			</svg>
			<table>
				<tbody>
					{#if $SendTxDetails.fromCoin && $SendTxDetails.fromNetwork}
						<tr>
							<td class="icon">
								<CoinNetworkIcon coin={fromCoin} network={$SendTxDetails.fromNetwork} size={32} />
							</td>
							<td class="sm-caption label"
								>From {fromCoinDisplayLabel} on {$SendTxDetails.fromNetwork?.label}</td
							>
							<td class="content">{prettyWithDisplayUnit(total)}</td>
						</tr>
					{/if}
					<tr>
						<td class="icon"><Dot size="32" /></td>
						<td class="sm-caption label">Fee</td>
						<td class="content">
							{#if $SendTxDetails.swapTotalFee && $SendTxDetails.fromCoin}
								{prettyWithDisplayUnit(new CoinAmount(Number($SendTxDetails.swapTotalFee), fromCoin, true))}
							{:else if $SendTxDetails.method?.value === TransferMethod.magiTransfer.value}
								No fee
							{:else if !$SendTxDetails.fee || !feeInUsd}
								<div class="fee-loading"><WaveLoading /></div>
							{:else}
									{prettyWithDisplayUnit($SendTxDetails.fee)}
								<EqualApproximately size={16} />
								{feeInUsd.toPrettyString()}
							{/if}
						</td>
					</tr>
					{#if $SendTxDetails.slippageBps != null && $SendTxDetails.minAmountOut && $SendTxDetails.toCoin}
						<tr>
							<td class="icon"><Dot size="32" /></td>
							<td class="sm-caption label">Slippage ({($SendTxDetails.slippageBps / 100).toFixed($SendTxDetails.slippageBps % 100 === 0 ? 0 : 1)}%)</td>
							<td class="content">
								Min. {prettyWithDisplayUnit(new CoinAmount(Number($SendTxDetails.minAmountOut), toCoin, true))}
							</td>
						</tr>
					{/if}
					<tr>
						<td class="icon"><Dot size="32" /></td>
						<td class="sm-caption label">Amount</td>
						<td class="content">
							{prettyWithDisplayUnit(new CoinAmount(effectiveFromAmount, fromCoin))}
							<EqualApproximately size={16} />
							{inUsd?.toPrettyString()}
						</td>
					</tr>
					{#if $SendTxDetails.fromCoin?.coin !== $SendTxDetails.toCoin?.coin}
						<tr>
							<td class="icon"><Dot size="32" /></td>
							<td class="sm-caption label">Market Rate</td>
							<td class="content">
								{prettyMinFigsWithDisplayUnit(new CoinAmount(1, fromCoin))}
								<EqualApproximately size="16" />
								{fromInTo ? prettyWithDisplayUnit(fromInTo) : ''}
							</td>
						</tr>
					{/if}
					{#if $SendTxDetails.toCoin && $SendTxDetails.toNetwork}
						<tr>
							<td class="icon">
								<CoinNetworkIcon coin={toCoin} network={$SendTxDetails.toNetwork} size={32} />
							</td>
							<td class="sm-caption label"
								>To {toCoinDisplayLabel} on {$SendTxDetails.toNetwork?.label}</td
							>
							<td class="content">
								{prettyWithDisplayUnit(convertedToAmount ?? new CoinAmount(effectiveToAmount, toCoin))}
							</td>
						</tr>
					{/if}
					<!-- <tr>
					<td class="sm-caption label">Initiated on</td>
					<td class="content">{today}</td>
				</tr> -->
				</tbody>
			</table>
		</Card>
	</div>
	<Card>
		<ul>
			<li class="side-by-side time">
				<span class="sm-caption label">Settlement Time</span>
				<span class="content">{$SendTxDetails.method?.length}</span>
			</li>
			<li class="side-by-side date">
				<span class="sm-caption label">Initiated On</span>
				<span class="content">{today}</span>
			</li>
			{#if $SendTxDetails.memo}
				<li class="side-by-side memo">
					<span class="sm-caption label">Memo</span>
					<span class="content">{$SendTxDetails.memo}</span>
				</li>
			{/if}
		</ul>
	</Card>
</div>

<TxStatus
	{status}
	{waiting}
	abort={() => abort?.()}
	showHiveWarning={auth.value?.provider === 'aioha'}
/>

<div class="popup-buttons">
	<PillButton onclick={() => previous?.()} theme="secondary" styleType="outline" disabled={waiting}>
		Back
	</PillButton>
	<PillButton onclick={() => next?.()} theme="accent" styleType="invert" disabled={waiting}>
		{waiting ? 'Waiting…' : 'Swap'}
	</PillButton>
</div>
	{/snippet}
</Dialog>

<style lang="scss">
	.stacked-cards {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.line-positioner {
		position: relative;
	}
	.dashed-line {
		position: absolute;
		height: 100%;
		width: 3px;
		translate: calc(3px + 1.5rem) 0;
		z-index: 0;
	}
	table,
	tbody,
	tr {
		width: calc(100% - 1rem);
	}
	.memo {
		width: calc(100% - 1rem);
		margin: 0 0.5rem;
		padding: 1rem 0;
		border-bottom: 1px solid var(--dash-card-border);
	}
	tr {
		display: grid;
		grid-template-columns: auto 1fr; /* Two columns: 1fr for image, 1fr for text */
		grid-template-rows: auto auto; /* Two rows for the text */
		gap: 0.25rem 1rem;
		grid-template-areas:
			'area-icon area-label'
			'area-icon area-content';
		padding: 0.5rem;
	}
	td {
		display: flex;
		align-items: center;
	}
	.icon {
		grid-area: area-icon;
		// same as width of coinnetworkicon
		width: calc(32px + 0.5rem);
		justify-content: space-around;
		color: var(--mid);
		z-index: 1;
	}
	.label {
		grid-area: area-label;
	}
	.content {
		line-height: 1.2;
		flex-basis: 0;
		flex-grow: 1;
		grid-area: area-content;
		:global(.lucide-equal-approximately) {
			min-width: 16px;
		}
	}
	.fee-loading {
		height: 20px;
		display: flex;
		align-items: center;
	}
	li {
		display: flex;
		align-items: center;
		padding: 1rem 0.5rem;
		.label {
			width: min(12rem, 40%);
		}
	}
	li:first-child {
		padding-top: 0.5rem;
	}
	li:last-child {
		padding-bottom: 0.5rem;
	}
	li:not(:last-child) {
		border-bottom: 1px solid var(--dash-card-border);
	}
	@media screen and (max-width: 450px) {
		table,
		tbody,
		tr {
			width: 100%;
		}
		tr {
			padding: 0.5rem 0;
		}
		.dashed-line {
			translate: calc(3px + 1rem) 0;
		}
	}

	.popup-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 1rem;
		margin-top: 1rem;
		border-top: 1px solid var(--dash-card-border);
	}
</style>
