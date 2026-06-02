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
	import { hasuraQuery } from '$lib/indexer/query';

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
	// Classify this contract call into one of: swap | add-liquidity | remove-liquidity | generic.
	// The classification drives which amount/label/direction is used for both the
	// table row and the side-popup detail view.
	type OpKind = 'swap' | 'add-liquidity' | 'remove-liquidity' | 'generic';

	const opKind: OpKind = $derived.by(() => {
		if (op.data.action !== 'execute' || !parsedPayload) return 'generic';
		const p = parsedPayload;

		// Add liquidity: payload type="deposit" + 2 intents (both assets sent in)
		if (
			p.type === 'deposit' &&
			p.asset0 && p.asset1 && p.amount0 != null && p.amount1 != null &&
			(op.data.intents?.length ?? 0) >= 2
		) return 'add-liquidity';

		// Remove liquidity: payload type="withdrawal" + lp_amount present
		if (p.type === 'withdrawal' && p.lp_amount != null) return 'remove-liquidity';

		return 'generic';
	});

	// ── Swap detection ──────────────────────────────────────────────────────
	// Two swap formats:
	//   New router (Altera):  { type:"swap", asset_in, asset_out, amount_in, min_amount_out }
	//   Old pool (legacy):    { type:"deposit", asset0, asset1, amount0, amount1 } (0-1 intents)
	// Both normalised to { asset0, amount0, asset1, amount1 } for display.
	const swapPayload = $derived.by(() => {
		if (opKind !== 'generic' || op.data.action !== 'execute' || !parsedPayload) return null;
		const p = parsedPayload;

		// New router format
		if (
			p.type === 'swap' &&
			p.asset_in && p.asset_out && p.amount_in != null
		) {
			return {
				asset0: String(p.asset_in).toLowerCase(),
				amount0: String(p.amount_in),
				asset1: String(p.asset_out).toLowerCase(),
				amount1: String(p.min_amount_out ?? '0'),
				isNewRouter: true
			};
		}
		// Old pool format — amount1 is the settled value. Only match when intent
		// count ≤ 1 (add-liquidity has ≥ 2 intents and is already classified above).
		if (
			p.asset0 && p.asset1 && p.amount0 != null && p.amount1 != null &&
			(!p.type || p.type === 'swap' || p.type === 'deposit')
		) {
			return { ...p, isNewRouter: false } as {
				asset0: string; amount0: string; asset1: string; amount1: string; isNewRouter: false
			};
		}
		return null;
	});

	const isSwap = $derived(swapPayload !== null);

	// For confirmed new-router swaps, fetch the actual settled amount_out from the indexer.
	let indexerAmountOut = $state.raw<{ amount_out: number; asset_out: string } | null>(null);
	let lastFetchedTxId = '';
	$effect(() => {
		if (!isSwap || !swapPayload?.isNewRouter || tx.isPending || tx.id === lastFetchedTxId) return;
		lastFetchedTxId = tx.id;
		hasuraQuery<{ dex_pool_swap_events: Array<{ amount_out: number; asset_out: string }> }>(
			`query GetSwapActualOutput($txHash: String!) {
				dex_pool_swap_events(where: {indexer_tx_hash: {_eq: $txHash}}, limit: 1) {
					amount_out
					asset_out
				}
			}`,
			{ txHash: tx.id }
		).then((data) => {
			const event = data?.dex_pool_swap_events?.[0];
			if (event) indexerAmountOut = event;
		});
	});

	// ── Liquidity amounts ───────────────────────────────────────────────────
	function coinFromAsset(asset: string): typeof Coin[keyof typeof Coin] {
		return Coin[asset.split('_')[0] as keyof typeof Coin] || Coin.unk;
	}

	// Add-liquidity: both token amounts the user deposited into the pool.
	const liqAmount0 = $derived(
		opKind === 'add-liquidity' && parsedPayload
			? new CoinAmount(String(parsedPayload.amount0), coinFromAsset(String(parsedPayload.asset0)), true)
			: null
	);
	const liqAmount1 = $derived(
		opKind === 'add-liquidity' && parsedPayload
			? new CoinAmount(String(parsedPayload.amount1), coinFromAsset(String(parsedPayload.asset1)), true)
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
		opKind === 'remove-liquidity' && parsedPayload
			? String(parsedPayload.lp_amount)
			: null
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

	let inUsd = $state(0);
	$effect(() => {
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
		secondAmount={opKind === 'add-liquidity' ? liqAmount1 : removeLiqAmount1}
		lpInfo={lpAmount}
	/>
	<Type {direction} t={displayType} />
</tr>

{#snippet contractRowContent()}
	<PopupTitleRow title={popupTitle} status={tx.status} />
	<p class="popup-subtitle">
		{moment(getTimestamp(tx)).format('MMM DD, YYYY [at] H:mm')}
		{#if op.data.from} · {op.data.from}{/if}
	</p>
	<div class="sections">
		<div class="amount">
			{#if isSwap && fromAmount}
				{fromAmount.toPrettyString()} → {amount.toPrettyString()}
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
				Approx. {formatUsd(inUsd)}
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
