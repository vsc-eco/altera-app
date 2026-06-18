<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount, formatUsd } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { settlementLabel } from '$lib/sendswap/utils/getNetwork';
	import moment from 'moment';
	import { requireTxState } from '$lib/sendswap/utils/txState.svelte';
	import { Dot, EqualApproximately, X } from '@lucide/svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import TxStatus from '../components/shared/TxStatus.svelte';
	import { getHiveAssetName, getHbdAssetName } from '../../../client';
	import { swapFeeExceedsGuard } from '$lib/pools/swapCalc';
	import { numberFormatLanguage } from '$lib/constants';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import {
		estimateBtcUnmapFee,
		type BtcFeeEstimate
	} from '$lib/magiTransactions/bitcoin/btcFeeEstimate';
	import {
		ALTERA_FEE_BPS,
		ALTERA_FEE_USD_THRESHOLD,
		getAlteraFeePct
	} from '$lib/magiTransactions/hive/vscOperations/swap';
	import {
		computeNetToAmountSmallest,
		isLightningWithdrawFlow
	} from '$lib/sendswap/utils/reviewSwapFees';

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

	const txState = requireTxState();
	const asSwap = $derived(txState.kind === 'swap' ? txState : null);

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

	let toCoin = $derived(txState.to?.coin ?? Coin.unk);
	let fromCoin = $derived(txState.from?.coin ?? Coin.unk);
	let effectiveFromAmount = $derived(txState.fromAmount || '0');
	// Pool fees are now denominated in the OUTPUT asset: the full input
	// enters the pool and fees are carved off the gross output. So the
	// "amount in" the user commits is simply the gross entered amount.
	let netSwapFromAmountCa = $derived(new CoinAmount(effectiveFromAmount, fromCoin));
	let effectiveToAmount = $derived(txState.toAmount || '0');
	const exchangeFeePct = $derived(getAlteraFeePct(fromCoin.value, toCoin.value));
	const isLightningWithdraw = $derived(
		isLightningWithdrawFlow({
			kind: txState.kind,
			fromNetwork: txState.from?.network.value,
			toNetwork: txState.to?.network.value,
			fromCoin: fromCoin.value,
			toCoin: toCoin.value
		})
	);
	const effectiveAlteraFeeBps = $derived(
		exchangeFeePct !== null ? Math.round(exchangeFeePct * 100) : 0
	);
	const alteraFeeLabelPct = $derived.by(() => {
		if (exchangeFeePct === null) return null;
		return Number.isInteger(exchangeFeePct)
			? exchangeFeePct.toFixed(1)
			: exchangeFeePct.toFixed(2);
	});
	// Compute the converted "to" amount reactively so it displays correctly.
	// Prefer the pool-math `expectedOutput` (already post-fee, in smallest
	// units) over the store's `toAmount` for swaps — otherwise the surface
	// computing `toAmount` (e.g. the QuickSwap card's lightning-rate
	// convertTo, which has no pool fees) can produce a value that
	// disagrees with `minAmountOut` (pool-math × 1-slippage), making the
	// Min. row render higher than the To row.
	let convertedToAmount = $state<CoinAmount<Coin> | undefined>();
	$effect(() => {
		const expectedRaw = asSwap?.expectedOutput;
		if (expectedRaw && expectedRaw !== '0') {
			convertedToAmount = new CoinAmount(Number(expectedRaw), toCoin, true);
			return;
		}
		const toAmt = txState.toAmount;
		if (toAmt && toAmt !== '0') {
			convertedToAmount = new CoinAmount(toAmt, toCoin);
			return;
		}
		// toAmount not yet available — fall back to fromAmount, converting
		// across coins when needed.
		const fromAmt = txState.fromAmount;
		if (!fromAmt || fromAmt === '0' || fromCoin.value === toCoin.value) {
			convertedToAmount = new CoinAmount(fromAmt || '0', toCoin);
			return;
		}
		new CoinAmount(fromAmt, fromCoin).convertTo(toCoin, Network.lightning).then((converted) => {
			// Only use if toAmount still not set
			const current = txState.toAmount;
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
		txState.to?.network.value === Network.btcMainnet.value &&
			txState.to?.coin.value === Coin.btc.value
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
	let total = $derived.by(() => {
		const gross = new CoinAmount(effectiveFromAmount, fromCoin);
		if (!txState.fee || isLightningWithdraw) return gross;
		return gross.add(txState.fee);
	});
	let fromInTo = $state<CoinAmount<Coin>>();
	$effect(() => {
		if (!txState.from || !txState.to) return;

		// Prefer the pool-math effective rate (expectedOutput / input)
		// over the lightning off-chain reference rate. Fees are
		// output-denominated, so the full entered amount goes into the pool.
		const expectedRaw = asSwap?.expectedOutput;
		if (expectedRaw && expectedRaw !== '0') {
			const expected = Number(expectedRaw);
			const grossIn = new CoinAmount(effectiveFromAmount, fromCoin).amount;
			if (grossIn > 0 && Number.isFinite(expected)) {
				const ratePerUnitSmallestOut = (expected * 10 ** fromCoin.decimalPlaces) / grossIn;
				fromInTo = new CoinAmount(Math.round(ratePerUnitSmallestOut), toCoin, true);
				return;
			}
		}

		new CoinAmount(1, txState.from.coin)
			.convertTo(txState.to.coin, Network.lightning)
			.then((amt) => {
				fromInTo = amt;
			});
	});
	let isInstructions = $derived(
		auth.value?.provider === 'reown' &&
			txState.from?.network.value === Network.hiveMainnet.value
	);
	$effect(() => {
		netSwapFromAmountCa.convertTo(Coin.usd, Network.lightning).then((amt) => {
			inUsd = amt;
		});
	});
	$effect(() => {
		txState.fee?.convertTo(Coin.usd, Network.lightning).then((amount) => {
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
		effectiveAlteraFeeBps > 0 &&
		!!txState.to &&
			txState.to.network.value !== Network.magi.value &&
			toCoin.value !== Coin.hive.value &&
			toCoin.value !== Coin.hbd.value &&
			!!grossInUsd &&
			grossInUsd.toNumber() >= ALTERA_FEE_USD_THRESHOLD
	);
	const alteraFeeAmount = $derived.by(() => {
		if (!alteraFeeApplies) return undefined;
		const out = convertedToAmount ?? new CoinAmount(effectiveToAmount, toCoin);
		const feeSmallest = Math.floor((out.amount * effectiveAlteraFeeBps) / 10000);
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
		const totalFeeRaw = asSwap?.swapTotalFee;
		const hop1 = asSwap?.swapHop1Fee;
		if (!totalFeeRaw || !txState.to) {
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
	// USD equivalent of the expected output amount.
	let outputInUsd = $state<CoinAmount<Coin>>();
	$effect(() => {
		const amt = convertedToAmount;
		if (!amt) { outputInUsd = undefined; return; }
		const netToSmallest = computeNetToAmountSmallest({
			rawToAmount: amt.amount,
			alteraFeeAmount: alteraFeeAmount?.amount,
			gatewayFeeAmount: txState.fee?.amount,
			isLightningWithdraw,
			gatewayFeeCoinMatchesToCoin: txState.fee?.coin.value === toCoin.value
		});
		new CoinAmount(netToSmallest, toCoin, true)
			.convertTo(Coin.usd, Network.lightning)
			.then((usd) => { outputInUsd = usd; });
	});

	// USD equivalent of the min-amount-out (after Altera fee deduction if applicable).
	let minAmountInUsd = $state<CoinAmount<Coin>>();
	$effect(() => {
		const minRaw = asSwap?.minAmountOut;
		if (!minRaw || !txState.to) { minAmountInUsd = undefined; return; }
		const minNet = alteraFeeApplies
			? Math.floor((Number(minRaw) * (10000 - effectiveAlteraFeeBps)) / 10000)
			: Number(minRaw);
		new CoinAmount(minNet, toCoin, true)
			.convertTo(Coin.usd, Network.lightning)
			.then((usd) => { minAmountInUsd = usd; });
	});

	// Whether this is a two-hop swap (determines fee label %).
	const isTwoHopSwap = $derived(!!asSwap?.swapHop1Fee);
	// Overcharge safety guard: warn + block the swap when the modelled fee is
	// abnormally high (contract pendulum CLP fee can spike — fixed upstream).
	// Mirrors the hard stop in sendUtils.send().
	const feeGuardTripped = $derived(swapFeeExceedsGuard(asSwap?.swapFeeBps));

	let today = moment().format('MMM D, YYYY');

	const senderAddress = $derived(
		auth.value ? (getUsernameFromAuth(auth) ?? auth.value.address ?? '') : ''
	);
	const receiverAddress = $derived(txState.toUsername ?? '');

	const isBtcSwap = $derived(
		fromCoin.value === Coin.btc.value || toCoin.value === Coin.btc.value
	);
	// Settlement-time copy: the slowest network among those involved in the TX.
	// `rail` (when set) carries the explicit intermediary; for BTC swaps the
	// btcMainnet floor preserves the legacy ~10 min override even on
	// magi-internal sats↔hbd swaps where the chosen networks would otherwise
	// suggest "Instant".
	const settlementTime = $derived(
		settlementLabel([txState.rail, isBtcSwap ? Network.btcMainnet : undefined])
	);

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
						{#if txState.from}
							<tr>
								<td class="icon">
									<CoinNetworkIcon coin={fromCoin} network={txState.from.network} size={32} />
								</td>
								<td class="sm-caption label"
									>From {fromCoinDisplayLabel} on {txState.from.network.label}{senderAddress
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
								{formatUsd(inUsd?.toNumber())}
							</td>
						</tr>
						<tr>
							<td class="icon"><Dot size="32" /></td>
							<td class="sm-caption label">{isLightningWithdraw ? 'V4V Fee' : 'Fee'}</td>
							<td class="content">
								{#if asSwap?.swapTotalFee && txState.to}
									{@const hop1 = asSwap.swapHop1Fee}
									{@const hop1Coin = hop1
										? hop1.asset === Coin.hbd.value
											? Coin.hbd
											: hop1.asset === Coin.hive.value
												? Coin.hive
												: Coin.btc
										: null}
									<div class="swap-fee-detail">
										<span class="fee-protocol-label">
											Protocol fee ({isTwoHopSwap ? '0.16%' : '0.08%'})
										</span>
										<span class="fee-amounts-line">
											{#if swapFeeInUsd}
												≈ {formatUsd(swapFeeInUsd.toNumber())}
											{:else}
												—
											{/if}
										</span>
									</div>
								{:else if txState.rail?.value === Network.magi.value}
									No fee
								{:else if !txState.fee || !feeInUsd}
									<div class="fee-loading"><WaveLoading /></div>
								{:else}
									{prettyWithDisplayUnit(txState.fee)}
									<EqualApproximately size={16} />
									{formatUsd(feeInUsd.toNumber())}
								{/if}
							</td>
						</tr>
						{#if exchangeFeePct !== null}
							<tr>
								<td class="icon"><Dot size="32" /></td>
								<td class="sm-caption label">Exchange Fee (Altera)</td>
								<td class="content" class:fee-free={exchangeFeePct === 0} class:fee-cost={exchangeFeePct > 0}>
									{exchangeFeePct === 0 ? 'Free' : `${exchangeFeePct}%`}
								</td>
							</tr>
						{/if}
						{#if txState.to}
							{@const rawTo = convertedToAmount ?? new CoinAmount(effectiveToAmount, toCoin)}
							{@const netToAmount = computeNetToAmountSmallest({
								rawToAmount: rawTo.amount,
								alteraFeeAmount: alteraFeeAmount?.amount,
								gatewayFeeAmount: txState.fee?.amount,
								isLightningWithdraw,
								gatewayFeeCoinMatchesToCoin: txState.fee?.coin.value === toCoin.value
							})}
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
							{#if exchangeFeePct !== null}
								<tr>
									<td class="icon"><Dot size="32" /></td>
									<td class="sm-caption label">Altera Fee ({alteraFeeLabelPct}%)</td
									>
									<td class="content">
										{#if alteraFeeAmount}
											{prettyWithDisplayUnit(alteraFeeAmount)}
											{#if alteraFeeInUsd}
												<EqualApproximately size={16} />
												{formatUsd(alteraFeeInUsd.toNumber())}
											{/if}
										{:else}
											Free
										{/if}
									</td>
								</tr>
							{/if}
							<tr>
								<td class="icon">
									<CoinNetworkIcon coin={toCoin} network={txState.to.network} size={32} />
								</td>
								<td class="sm-caption label"
									>To {toCoinDisplayLabel} on {txState.to.network.label}{receiverAddress
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
										{#if outputInUsd}
											<EqualApproximately size={16} />
											{formatUsd(outputInUsd.toNumber())}
										{/if}
									{/if}
								</td>
							</tr>
							{#if asSwap?.slippageBps != null}
								<tr>
									<td class="icon"><Dot size="32" /></td>
									<td class="sm-caption label">Min amount received</td>
									<td class="content">
										{#if asSwap.swapCalcPending}
											<div class="fee-loading"><WaveLoading size={16} /></div>
										{:else if asSwap.minAmountOut && txState.to}
											{@const minRaw = alteraFeeApplies
												? Math.floor(
														(Number(asSwap.minAmountOut) * (10000 - effectiveAlteraFeeBps)) /
															10000
													)
												: Number(asSwap.minAmountOut)}
											{#if btcFeeEstimate}
												~{prettyRangeWithDisplayUnit(
													new CoinAmount(
														Math.max(0, minRaw - btcFeeEstimate.maxSats),
														toCoin,
														true
													),
													new CoinAmount(Math.max(0, minRaw - btcFeeEstimate.minSats), toCoin, true)
												)}
											{:else}
												{prettyWithDisplayUnit(new CoinAmount(minRaw, toCoin, true))}
												{#if minAmountInUsd}
													<EqualApproximately size={16} />
													{formatUsd(minAmountInUsd.toNumber())}
												{/if}
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
					<span class="content">{settlementTime}</span>
				</li>
				<li class="side-by-side date">
					<span class="sm-caption label">Initiated On</span>
					<span class="content">{today}</span>
				</li>
			</ul>
		</Card>
	</div>

	<TxStatus
		{status}
		{waiting}
		abort={() => abort?.()}
		showHiveWarning={auth.value?.provider === 'aioha'}
	/>

	{#if feeGuardTripped}
		<p class="fee-guard-warning">
			This swap is temporarily blocked: the network would charge an abnormally high fee
			(~{((asSwap?.swapFeeBps ?? 0) / 100).toFixed(1)}%) on it right now. Try a smaller amount, or
			wait until it's resolved.
		</p>
	{/if}

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
			<PillButton
				onclick={() => next?.()}
				theme="accent"
				styleType="invert"
				disabled={waiting || feeGuardTripped}
			>
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
	.fee-guard-warning {
		margin: 0.75rem 0 0;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--dash-accent-red, #dc2626);
		border-radius: 12px;
		color: var(--dash-accent-red, #dc2626);
		font-size: 0.85rem;
		line-height: 1.45;
	}
	.stacked-cards {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		/* Ensure the dialog is wide enough on medium+ screens so values
		   don't wrap onto a second line. max-content dialog sizing means
		   this sets the effective minimum dialog width. */
		min-width: clamp(22rem, 88vw, 36rem);
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
	.fee-free {
		color: var(--dash-accent-green) !important;
	}
	.fee-cost {
		color: #f59e0b !important;
	}
	.content {
		line-height: 1.2;
		flex-basis: 0;
		flex-grow: 1;
		grid-area: area-content;
		flex-wrap: wrap;
		gap: 0.25rem;
		:global(.lucide-equal-approximately) {
			min-width: 16px;
		}
	}
	.fee-loading {
		height: 20px;
		display: flex;
		align-items: center;
	}
	.swap-fee-detail {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.fee-protocol-label {
		color: var(--dash-text-secondary);
		font-size: var(--text-xs);
	}
	.fee-amounts-line {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
		:global(.lucide-equal-approximately) {
			min-width: 14px;
		}
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
