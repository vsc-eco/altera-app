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
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import {
		estimateBtcUnmapFee,
		type BtcFeeEstimate
	} from '$lib/magiTransactions/bitcoin/btcFeeEstimate';
	import {
		ALTERA_FEE_BPS,
		ALTERA_FEE_USD_THRESHOLD
	} from '$lib/magiTransactions/hive/vscOperations/swap';

	const auth = $derived(getAuth()());
	let {
		editStage = () => {},
		isActive = true,
		status,
		waiting = false,
		abort = () => {},
		next,
		previous,
		goHome,
		popup = false
	}: {
		editStage?: (complete: boolean) => void;
		isActive?: boolean;
		status: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
		next?: () => void;
		previous?: () => void;
		goHome?: () => void;
		popup?: boolean;
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
	let lastDialogOpen = false;
	$effect(() => {
		if (!popup) return;
		if (isActive !== lastIsActive) {
			lastIsActive = isActive;
			dialogToggle?.(isActive);
			lastDialogOpen = isActive;
		}
	});
	// User dismissed the dialog (X / backdrop / Esc) while the steps
	// machine still considers this stage active. Send them back to
	// the home step so the parent's NavButtons (Swap button) shows
	// again. Without this the steps machine stays pinned to the
	// popup stage and NavButtons stays hidden.
	$effect(() => {
		if (!popup) return;
		if (dialogOpen === lastDialogOpen) return;
		lastDialogOpen = dialogOpen;
		if (!dialogOpen && isActive) {
			goHome?.();
		}
	});

	let toCoin = $derived($SendTxDetails.toCoin?.coin ?? Coin.unk);
	let fromCoin = $derived($SendTxDetails.fromCoin?.coin ?? Coin.unk);
	let effectiveFromAmount = $derived(
		$SendTxDetails.fromAmount && $SendTxDetails.fromAmount !== '0'
			? $SendTxDetails.fromAmount
			: $SendTxDetails.enteredAmount
	);
	// Pool fees are now denominated in the OUTPUT asset: the full input
	// enters the pool and fees are carved off the gross output. So the
	// "amount in" the user commits is simply the gross entered amount.
	let netSwapFromAmountCa = $derived(new CoinAmount(effectiveFromAmount, fromCoin));
	let effectiveToAmount = $derived(
		$SendTxDetails.toAmount && $SendTxDetails.toAmount !== '0'
			? $SendTxDetails.toAmount
			: $SendTxDetails.enteredAmount
	);
	// When from/to coins differ, the enteredAmount fallback is in the wrong denomination.
	// Compute the converted "to" amount reactively so it displays correctly.
	// Prefer the pool-math `expectedOutput` (already post-fee, in smallest
	// units) over the store's `toAmount` for swaps — otherwise the surface
	// computing `toAmount` (e.g. the QuickSwap card's lightning-rate
	// convertTo, which has no pool fees) can produce a value that
	// disagrees with `minAmountOut` (pool-math × 1-slippage), making the
	// Min. row render higher than the To row.
	let convertedToAmount = $state<CoinAmount<Coin> | undefined>();
	$effect(() => {
		const expectedRaw = $SendTxDetails.expectedOutput;
		if (expectedRaw && expectedRaw !== '0') {
			convertedToAmount = new CoinAmount(Number(expectedRaw), toCoin, true);
			return;
		}
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
		new CoinAmount(entered, fromCoin).convertTo(toCoin, Network.lightning).then((converted) => {
			// Only use if toAmount still not set
			const current = $SendTxDetails.toAmount;
			if (!current || current === '0') {
				convertedToAmount = converted;
			}
		});
	});
	const fromCoinDisplayLabel = $derived(
		fromCoin.value === Coin.hive.value
			? getHiveAssetName()
			: fromCoin.value === Coin.hbd.value
				? getHbdAssetName()
				: fromCoin.label
	);
	const toCoinDisplayLabel = $derived(
		toCoin.value === Coin.hive.value
			? getHiveAssetName()
			: toCoin.value === Coin.hbd.value
				? getHbdAssetName()
				: toCoin.label
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
	function prettyMinFigsWithDisplayUnit(
		amt: CoinAmount<Coin>,
		figures?: number,
		decimals?: number
	): string {
		const isNegative = amt.amount < 0;
		const n = Math.abs(amt.amount) / 10 ** amt.coin.decimalPlaces;
		const dec = decimals ?? amt.coin.decimalPlaces;
		const minFigs =
			n < 1 ? Math.min(amt.coin.decimalPlaces, figures ?? dec + 1) : (figures ?? dec + 1);
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
	// Approximate BTC network fee for transfers that settle out to Bitcoin
	// mainnet. The contract calculates the real fee at unmap time from its
	// stored BaseFeeRate; we port the same math for a 1–3-input range so the
	// user sees what will be deducted from `expectedOutput` and `minAmountOut`.
	let btcFeeEstimate = $state<BtcFeeEstimate | null>(null);
	const isToBtcMainnet = $derived(
		$SendTxDetails.toNetwork?.value === Network.btcMainnet.value &&
			$SendTxDetails.toCoin?.coin.value === Coin.btc.value
	);
	$effect(() => {
		if (!isToBtcMainnet) {
			btcFeeEstimate = null;
			return;
		}
		let cancelled = false;
		estimateBtcUnmapFee().then((est) => {
			if (!cancelled) btcFeeEstimate = est;
		});
		return () => {
			cancelled = true;
		};
	});
	/** Format a sat count as a thousands-grouped integer. */
	function formatSats(sats: number): string {
		return new Intl.NumberFormat(numberFormatLanguage, { useGrouping: true }).format(
			Math.max(0, Math.round(sats))
		);
	}
	/** Render `low – high UNIT` using `prettyWithDisplayUnit`, unit shown once. */
	function prettyRangeWithDisplayUnit(low: CoinAmount<Coin>, high: CoinAmount<Coin>): string {
		const highStr = prettyWithDisplayUnit(high);
		const lowStr = prettyWithDisplayUnit(low);
		const sp = lowStr.lastIndexOf(' ');
		const lowNum = sp > 0 ? lowStr.slice(0, sp) : lowStr;
		return `${lowNum} – ${highStr}`;
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

		// Prefer the pool-math effective rate (expectedOutput / input)
		// over the lightning off-chain reference rate. Otherwise the
		// Market Rate row and the To row disagree whenever the pool is
		// not at the lightning price — user sees "1 X = 0.06 Y" with
		// "To 0.642 Y" for a 10 X input and it looks like broken math.
		// Fees are output-denominated now, so the full entered amount
		// is what goes into the pool.
		const expectedRaw = $SendTxDetails.expectedOutput;
		if (expectedRaw && expectedRaw !== '0') {
			const expected = Number(expectedRaw);
			const grossIn = new CoinAmount(effectiveFromAmount, fromCoin).amount;
			if (grossIn > 0 && Number.isFinite(expected)) {
				const ratePerUnitSmallestOut = (expected * 10 ** fromCoin.decimalPlaces) / grossIn;
				fromInTo = new CoinAmount(Math.round(ratePerUnitSmallestOut), toCoin, true);
				return;
			}
		}

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
		netSwapFromAmountCa.convertTo(Coin.usd, Network.lightning).then((amt) => {
			inUsd = amt;
		});
	});
	$effect(() => {
		$SendTxDetails.fee?.convertTo(Coin.usd, Network.lightning).then((amount) => {
			feeInUsd = amount;
		});
	});

	let grossInUsd = $state<CoinAmount<Coin>>();
	$effect(() => {
		new CoinAmount(effectiveFromAmount, fromCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amt) => {
				grossInUsd = amt;
			});
	});
	const alteraFeeApplies = $derived(
		!!$SendTxDetails.toNetwork &&
			$SendTxDetails.toNetwork.value !== Network.magi.value &&
			toCoin.value !== Coin.hive.value &&
			toCoin.value !== Coin.hbd.value &&
			!!grossInUsd &&
			grossInUsd.toNumber() >= ALTERA_FEE_USD_THRESHOLD
	);
	const alteraFeeAmount = $derived.by(() => {
		if (!alteraFeeApplies) return undefined;
		const out = convertedToAmount ?? new CoinAmount(effectiveToAmount, toCoin);
		const feeSmallest = Math.floor((out.amount * ALTERA_FEE_BPS) / 10000);
		if (feeSmallest <= 0) return undefined;
		return new CoinAmount(feeSmallest, toCoin, true);
	});
	let alteraFeeInUsd = $state<CoinAmount<Coin>>();
	$effect(() => {
		if (!alteraFeeAmount) {
			alteraFeeInUsd = undefined;
			return;
		}
		alteraFeeAmount.convertTo(Coin.usd, Network.lightning).then((amt) => {
			alteraFeeInUsd = amt;
		});
	});

	// USD equivalent of the pool fee(s). One-hop: convert the single
	// output-asset total. Two-hop: convert each hop's total in its own
	// asset, then sum — both amounts are what the user effectively pays.
	let swapFeeInUsd = $state<CoinAmount<Coin>>();
	$effect(() => {
		const totalFeeRaw = $SendTxDetails.swapTotalFee;
		const hop1 = $SendTxDetails.swapHop1Fee;
		if (!totalFeeRaw || !$SendTxDetails.toCoin) {
			swapFeeInUsd = undefined;
			return;
		}
		const hop2Amt = new CoinAmount(Number(totalFeeRaw), toCoin, true);
		const hop1Coin = hop1
			? hop1.asset === Coin.hbd.value
				? Coin.hbd
				: hop1.asset === Coin.hive.value
					? Coin.hive
					: hop1.asset === Coin.btc.value
						? Coin.btc
						: null
			: null;
		const hop1Amt =
			hop1 && hop1Coin ? new CoinAmount(Number(hop1.totalFee), hop1Coin, true) : null;

		Promise.all([
			hop2Amt.convertTo(Coin.usd, Network.lightning),
			hop1Amt ? hop1Amt.convertTo(Coin.usd, Network.lightning) : Promise.resolve(null)
		]).then(([hop2Usd, hop1Usd]) => {
			swapFeeInUsd = hop1Usd ? hop2Usd.add(hop1Usd) : hop2Usd;
		});
	});
	let today = moment().format('MMM D, YYYY');

	const senderAddress = $derived(
		auth.value ? (getUsernameFromAuth(auth) ?? auth.value.address ?? '') : ''
	);
	const receiverAddress = $derived($SendTxDetails.toUsername ?? '');
</script>

{#snippet reviewContent()}
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
									>From {fromCoinDisplayLabel} on {$SendTxDetails.fromNetwork?.label}{senderAddress
										? ` (${senderAddress})`
										: ''}</td
								>
								<td class="content">{prettyWithDisplayUnit(total)}</td>
							</tr>
						{/if}
						<tr>
							<td class="icon"><Dot size="32" /></td>
							<td class="sm-caption label">Amount</td>
							<td class="content">
								{prettyWithDisplayUnit(netSwapFromAmountCa)}
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
						<tr>
							<td class="icon"><Dot size="32" /></td>
							<td class="sm-caption label">Fee</td>
							<td class="content">
								{#if $SendTxDetails.swapTotalFee && $SendTxDetails.toCoin}
									{#if $SendTxDetails.swapHop1Fee}
										{@const hopCoin =
											$SendTxDetails.swapHop1Fee.asset === Coin.hbd.value
												? Coin.hbd
												: $SendTxDetails.swapHop1Fee.asset === Coin.hive.value
													? Coin.hive
													: Coin.btc}
										{prettyWithDisplayUnit(
											new CoinAmount(Number($SendTxDetails.swapHop1Fee.totalFee), hopCoin, true)
										)}
										and
										{prettyWithDisplayUnit(
											new CoinAmount(Number($SendTxDetails.swapTotalFee), toCoin, true)
										)}
									{:else}
										{prettyWithDisplayUnit(
											new CoinAmount(Number($SendTxDetails.swapTotalFee), toCoin, true)
										)}
									{/if}
									{#if swapFeeInUsd}
										<EqualApproximately size={16} />
										{swapFeeInUsd.toPrettyString()}
									{/if}
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
						{#if $SendTxDetails.toCoin && $SendTxDetails.toNetwork}
							{@const rawTo = convertedToAmount ?? new CoinAmount(effectiveToAmount, toCoin)}
							{@const netToAmount = Math.max(0, rawTo.amount - (alteraFeeAmount?.amount ?? 0))}
							{#if isToBtcMainnet && btcFeeEstimate}
								<tr>
									<td class="icon"><Dot size="32" /></td>
									<td class="sm-caption label">BTC Network Fee</td>
									<td class="content">
										~{new CoinAmount(btcFeeEstimate.minSats, Coin.btc, true)} - {new CoinAmount(
											btcFeeEstimate.maxSats,
											Coin.btc,
											true
										)}
									</td>
								</tr>
							{/if}
							{#if alteraFeeAmount}
								<tr>
									<td class="icon"><Dot size="32" /></td>
									<td class="sm-caption label">Altera Fee ({(ALTERA_FEE_BPS / 100).toFixed(2)}%)</td
									>
									<td class="content">
										{prettyWithDisplayUnit(alteraFeeAmount)}
										{#if alteraFeeInUsd}
											<EqualApproximately size={16} />
											{alteraFeeInUsd.toPrettyString()}
										{/if}
									</td>
								</tr>
							{/if}
							<tr>
								<td class="icon">
									<CoinNetworkIcon coin={toCoin} network={$SendTxDetails.toNetwork} size={32} />
								</td>
								<td class="sm-caption label"
									>To {toCoinDisplayLabel} on {$SendTxDetails.toNetwork?.label}{receiverAddress
										? ` (${receiverAddress})`
										: ''}</td
								>
								<td class="content">
									{#if btcFeeEstimate}
										~{prettyRangeWithDisplayUnit(
											new CoinAmount(
												Math.max(0, netToAmount - btcFeeEstimate.maxSats),
												toCoin,
												true
											),
											new CoinAmount(
												Math.max(0, netToAmount - btcFeeEstimate.minSats),
												toCoin,
												true
											)
										)}
									{:else}
										{prettyWithDisplayUnit(new CoinAmount(netToAmount, toCoin, true))}
									{/if}
								</td>
							</tr>
							{#if $SendTxDetails.slippageBps != null}
								<tr>
									<td class="icon"><Dot size="32" /></td>
									<td class="sm-caption label"
										>Slippage ({($SendTxDetails.slippageBps / 100).toFixed(
											$SendTxDetails.slippageBps % 100 === 0 ? 0 : 1
										)}%)</td
									>
									<td class="content">
										{#if $SendTxDetails.minAmountOut && $SendTxDetails.toCoin}
											{@const minRaw = alteraFeeApplies
												? Math.floor(
														(Number($SendTxDetails.minAmountOut) * (10000 - ALTERA_FEE_BPS)) / 10000
													)
												: Number($SendTxDetails.minAmountOut)}
											{#if btcFeeEstimate}
												Min. ~{prettyRangeWithDisplayUnit(
													new CoinAmount(
														Math.max(0, minRaw - btcFeeEstimate.maxSats),
														toCoin,
														true
													),
													new CoinAmount(Math.max(0, minRaw - btcFeeEstimate.minSats), toCoin, true)
												)}
											{:else}
												Min. {prettyWithDisplayUnit(new CoinAmount(minRaw, toCoin, true))}
											{/if}
										{:else}
											—
										{/if}
									</td>
								</tr>
							{/if}
						{/if}
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

	{#if popup}
		<div class="popup-buttons">
			<PillButton
				onclick={() => previous?.()}
				theme="secondary"
				styleType="outline"
				disabled={waiting}
			>
				Back
			</PillButton>
			<PillButton onclick={() => next?.()} theme="accent" styleType="invert" disabled={waiting}>
				{waiting ? 'Waiting…' : 'Swap'}
			</PillButton>
		</div>
	{/if}
{/snippet}

{#if popup}
	<Dialog bind:open={dialogOpen} bind:toggle={dialogToggle}>
		{#snippet title()}
			Review Swap
		{/snippet}
		{#snippet content()}
			{@render reviewContent()}
		{/snippet}
	</Dialog>
{:else}
	{@render reviewContent()}
{/if}

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
