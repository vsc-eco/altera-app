<script lang="ts">
	import {
		getTimestamp,
		type TransactionInter,
		type TransactionOpType
	} from '$lib/stores/txStores';
	import moment from 'moment';
	import type { Snippet } from 'svelte';
	import Type from '../tds/Type.svelte';
	import { ExternalLink } from '@lucide/svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import Amount from '../tds/Amount.svelte';
	import Status from '../tds/Status.svelte';
	import { CoinAmount, formatUsd } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import ContractId from '../tds/ContractId.svelte';
	import PopupTitleRow from './PopupTitleRow.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import { hasuraQuery } from '$lib/indexer/query';
	import {
		classifyContractOp,
		isAwaitingSettledAmount,
		swapEventHashCandidates
	} from './swapDisplay';

	type Props = {
		tx: TransactionInter;
		op: TransactionOpType;
		onRowClick: (op: [string, number], content: () => ReturnType<Snippet>) => void;
	};
	let { tx, op, onRowClick }: Props = $props();

	function handleTrigger() {
		onRowClick([tx.id, op.index], contractRowContent);
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTrigger();
			e.preventDefault();
		}
	}

	// ── Payload parsing ─────────────────────────────────────────────────────
	// Parsed once and reused by swap / liquidity / fallback logic below.
	const parsedPayload = $derived.by(() => {
		try {
			return JSON.parse(op.data.payload ?? '') as Record<string, unknown>;
		} catch {
			return null;
		}
	});

	// ── Operation classification ────────────────────────────────────────────
	// Classify this contract call into one of: swap | add-liquidity | remove-liquidity | generic,
	// and normalise both swap payload formats. The pure logic lives in
	// swapDisplay.ts so the swap-amount decision (min_amount_out vs settled) is
	// unit-tested. The classification drives which amount/label/direction is used
	// for both the table row and the side-popup detail view.
	const classified = $derived(
		classifyContractOp(parsedPayload, op.data.action, op.data.intents?.length ?? 0)
	);
	const opKind = $derived(classified.opKind);
	const swapPayload = $derived(classified.swapPayload);

	const isSwap = $derived(swapPayload !== null);

	// For confirmed new-router swaps the only trustworthy output is the settled
	// `amount_out` from the indexer. The swap payload's `amount1` is just
	// `min_amount_out` (the slippage floor) — showing it as the received amount
	// under-reports the real fill, which is what caused "same tx, different
	// numbers minutes apart". The indexer can lag a few seconds behind
	// confirmation, so we POLL a handful of times instead of giving up after one
	// empty response, and we never display the floor in the meantime (see
	// `awaitingSettledAmount` / the loading copy below).
	let indexerAmountOut = $state.raw<{ amount_out: number; asset_out: string } | null>(null);
	// Acts as the current-tx token: stale polls (component reused for a new tx)
	// detect the change and bail without writing. A fresh mount (e.g. reopening
	// the popup later) resets this and re-polls, so a transient indexer miss
	// self-heals on the next open.
	let startedFetchTxId = '';
	$effect(() => {
		// A failed swap produces no settlement event — don't poll the indexer for it.
		if (!isSwap || !swapPayload?.isNewRouter || tx.isPending || tx.status === 'FAILED') return;
		const thisTxId = tx.id;
		if (thisTxId === startedFetchTxId) return;
		startedFetchTxId = thisTxId;
		indexerAmountOut = null;

		const hashCandidates = swapEventHashCandidates(thisTxId, op.index);

		// ~15s of polling, backing off, before we conclude the indexer has no row.
		const delaysMs = [0, 1000, 2000, 4000, 8000];
		(async () => {
			for (const delay of delaysMs) {
				if (delay) await new Promise((r) => setTimeout(r, delay));
				if (startedFetchTxId !== thisTxId) return; // superseded by a newer tx
				const data = await hasuraQuery<{
					dex_pool_swap_events: Array<{ amount_out: number; asset_out: string }>;
				}>(
					`query GetSwapActualOutput($hashes: [String!]!) {
						dex_pool_swap_events(where: {indexer_tx_hash: {_in: $hashes}}, limit: 1) {
							amount_out
							asset_out
						}
					}`,
					{ hashes: hashCandidates }
				);
				if (startedFetchTxId !== thisTxId) return;
				const event = data?.dex_pool_swap_events?.[0];
				if (event) {
					indexerAmountOut = event;
					break;
				}
			}
		})();
	});

	// True while a confirmed new-router swap's real output is still unknown — the
	// window in which we must NOT show min_amount_out. Drives the loading copy.
	const isFailedTx = $derived(tx.status === 'FAILED');
	const awaitingSettledAmount = $derived(
		isAwaitingSettledAmount({
			isSwap,
			isNewRouter: !!swapPayload?.isNewRouter,
			isPending: tx.isPending,
			hasIndexerAmount: !!indexerAmountOut,
			isFailed: isFailedTx
		})
	);

	// ── Liquidity amounts ───────────────────────────────────────────────────
	function coinFromAsset(asset: string): (typeof Coin)[keyof typeof Coin] {
		return Coin[asset.split('_')[0] as keyof typeof Coin] || Coin.unk;
	}

	// Add-liquidity: both token amounts the user deposited into the pool.
	const liqAmount0 = $derived(
		opKind === 'add-liquidity' && parsedPayload
			? new CoinAmount(
					String(parsedPayload.amount0),
					coinFromAsset(String(parsedPayload.asset0)),
					true
				)
			: null
	);
	const liqAmount1 = $derived(
		opKind === 'add-liquidity' && parsedPayload
			? new CoinAmount(
					String(parsedPayload.amount1),
					coinFromAsset(String(parsedPayload.asset1)),
					true
				)
			: null
	);

	// Remove-liquidity: the ledger contains the actual amounts the user received back.
	// Fall back to LP token count from the payload when ledger is unavailable (pending tx).
	const removeLiqAmount0 = $derived.by(() => {
		if (opKind !== 'remove-liquidity') return null;
		const entry = tx.ledger?.[0];
		if (entry) return new CoinAmount(entry.amount, coinFromAsset(entry.asset), true);
		return null;
	});
	const removeLiqAmount1 = $derived.by(() => {
		if (opKind !== 'remove-liquidity') return null;
		const entry = tx.ledger?.[1];
		if (entry) return new CoinAmount(entry.amount, coinFromAsset(entry.asset), true);
		return null;
	});
	const lpAmount = $derived(
		opKind === 'remove-liquidity' && parsedPayload ? String(parsedPayload.lp_amount) : null
	);

	// ── Swap amounts ────────────────────────────────────────────────────────
	const fromAmount = $derived(
		isSwap && swapPayload
			? new CoinAmount(swapPayload.amount0, coinFromAsset(swapPayload.asset0), true)
			: null
	);
	const amount = $derived.by(() => {
		if (isSwap && swapPayload) {
			if (indexerAmountOut && !tx.isPending) {
				return new CoinAmount(
					indexerAmountOut.amount_out,
					coinFromAsset(indexerAmountOut.asset_out),
					true
				);
			}
			return new CoinAmount(swapPayload.amount1, coinFromAsset(swapPayload.asset1), true);
		}
		// Add-liquidity: show first token amount as the primary display
		if (opKind === 'add-liquidity' && liqAmount0) return liqAmount0;
		// Remove-liquidity: show first received amount from ledger
		if (opKind === 'remove-liquidity' && removeLiqAmount0) return removeLiqAmount0;
		// Generic: fall back to first intent limit
		const intents = op.data.intents;
		const amt = intents?.[0]?.args?.limit ?? '0';
		const coinVal = intents?.[0]?.args?.token ?? Coin.hive.value;
		return new CoinAmount(amt, Coin[coinVal.split('_')[0] as keyof typeof Coin] || Coin.hive, true);
	});

	// The slippage floor (min_amount_out) for a new-router swap — a meaningful
	// GUARANTEED MINIMUM to reassure the user while the exact settled amount is
	// still being fetched ("you'll receive at least X"). Null when there's no
	// protective floor (min_amount_out "0"), so we don't show "at least 0".
	const minReceived = $derived.by(() => {
		if (!isSwap || !swapPayload?.isNewRouter) return null;
		const floor = new CoinAmount(swapPayload.amount1, coinFromAsset(swapPayload.asset1), true);
		return floor.toNumber() > 0 ? floor : null;
	});

	let inUsd = $state(0);
	$effect(() => {
		// Don't price the slippage floor while the settled amount is still pending —
		// it would show a misleading USD value that then jumps once it resolves.
		if (awaitingSettledAmount) return;
		amount.convertTo(Coin.usd, Network.lightning).then((a) => {
			inUsd = a.toNumber();
		});
	});

	// ── Display type & direction ────────────────────────────────────────────
	const displayType: string = $derived.by(() => {
		if (isSwap) return 'swap';
		if (opKind === 'add-liquidity') return 'add liquidity';
		if (opKind === 'remove-liquidity') return 'remove liquidity';
		if (parsedPayload?.type) return String(parsedPayload.type).replace(/_/g, ' ');
		return op.data.action ?? op.type ?? 'call';
	});

	const direction: 'swap' | 'add-liquidity' | 'remove-liquidity' | 'contract' = $derived.by(() => {
		if (isSwap) return 'swap';
		if (opKind === 'add-liquidity') return 'add-liquidity';
		if (opKind === 'remove-liquidity') return 'remove-liquidity';
		return 'contract';
	});

	const popupTitle = $derived(
		displayType
			.replace(/_/g, ' ')
			.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase())
	);
</script>

<tr
	data-tx-id={tx.id}
	tabindex="0"
	onclick={handleTrigger}
	onkeydown={handleKeydown}
	class="clickable-row"
>
	<td class="date">{moment(getTimestamp(tx)).format('MMM DD')}</td>
	<ContractId address={op.data.contract_id ?? ''} />
	<Status status={tx.status} />
	<Amount
		{amount}
		{fromAmount}
		{direction}
		pendingAmount={awaitingSettledAmount}
		failed={isFailedTx}
		secondAmount={opKind === 'add-liquidity' ? liqAmount1 : removeLiqAmount1}
		lpInfo={lpAmount}
	/>
	<Type {direction} t={displayType} />
</tr>

{#snippet contractRowContent()}
	<PopupTitleRow title={popupTitle} status={tx.status} />
	<p class="popup-subtitle">
		{moment(getTimestamp(tx)).format('MMM DD, YYYY [at] H:mm')}
		{#if op.data.from}
			· {op.data.from}{/if}
	</p>
	<div class="sections">
		<div class="amount">
			{#if isSwap && fromAmount}
				{fromAmount.toPrettyString()} →
				{#if isFailedTx}
					<span class="none">—</span>
				{:else if awaitingSettledAmount}
					<span class="settling"><WaveLoading size={28} /></span>
				{:else}
					{amount.toPrettyString()}
				{/if}
			{:else if opKind === 'add-liquidity' && liqAmount0 && liqAmount1}
				{liqAmount0.toPrettyString()} + {liqAmount1.toPrettyString()}
			{:else if opKind === 'remove-liquidity' && removeLiqAmount0 && removeLiqAmount1}
				{removeLiqAmount0.toPrettyString()} + {removeLiqAmount1.toPrettyString()}
				{#if lpAmount}
					<span class="approx-usd">Burned {lpAmount} LP tokens</span>
				{/if}
			{:else if opKind === 'remove-liquidity' && lpAmount}
				{lpAmount} LP tokens
			{:else}
				{amount.toPrettyString()}
			{/if}
			<span class="approx-usd">
				{#if isFailedTx}
					Failed — nothing was received.
				{:else if awaitingSettledAmount}
					Waiting for the network to report the settled amount…
					{#if minReceived}
						<span class="settle-floor">You'll receive at least {minReceived.toPrettyString()}.</span
						>
					{/if}
				{:else}
					Approx. {formatUsd(inUsd)}
				{/if}
			</span>
		</div>
		<div class="tx-id section">
			<h3>Transaction Id</h3>
			<Clipboard value={tx.id} label="" disabled={tx.isPending && tx.id == 'UNK'} />
		</div>
		<div class="links section">
			<h3>External Links</h3>
			<div class={`links ${tx.isPending ? 'links-disabled' : ''}`}>
				<a href={'https://vsc.techcoderx.com/tx/' + tx.id} target="_blank" rel="noreferrer">
					VSC Block Explorer<ExternalLink /></a
				>
			</div>
		</div>
	</div>
{/snippet}

<style>
	tr:hover,
	tr {
		cursor: pointer;
		transition: background-color 1s;
		animation: highlight-in 1s both;
	}
	.popup-subtitle {
		margin: 0;
		font-size: 0.8rem;
		color: var(--dash-text-muted);
	}
	.amount {
		font-size: var(--text-4xl);
		margin: 0;
	}
	.approx-usd {
		display: block;
		text-wrap: wrap;
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
		margin-top: 0.25rem;
	}
	.settling {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		color: var(--dash-text-muted);
	}
	.none {
		color: var(--dash-text-muted);
	}
	.settle-floor {
		display: block;
		margin-top: 0.2rem;
		color: var(--dash-text-secondary);
	}
	.date {
		color: var(--dash-text-secondary);
		white-space: nowrap;
		min-width: 4rem;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	a :global(svg) {
		width: 16px;
	}
	h3 {
		font-size: var(--text-sm);
		font-weight: 600;
		margin-top: 0;
	}
	.section {
		padding: 0.5rem;
		border-radius: 12px;
		position: relative;
		flex-shrink: 0;
		flex-basis: auto;
	}
	.sections {
		display: flex;
		flex-direction: column;
		/* align-items: stretch; */
		flex: 1;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.links {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.links.section {
		display: inline;
	}

	.tx-id.section {
		margin-top: 0.75rem;
	}
</style>
