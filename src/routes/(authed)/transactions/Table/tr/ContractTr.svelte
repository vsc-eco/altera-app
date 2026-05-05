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
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import ContractId from '../tds/ContractId.svelte';
	import PopupTitleRow from './PopupTitleRow.svelte';

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

	// Parse the swap payload from call/execute ops.
	// Two formats exist:
	//   New router (Altera):  { type:"swap", asset_in, asset_out, amount_in, min_amount_out }
	//   Old pool (legacy):    { type:"deposit", asset0, asset1, amount0, amount1 }
	// Both are normalised to { asset0, amount0, asset1, amount1 } for display.
	const swapPayload = $derived.by(() => {
		try {
			const parsed = JSON.parse(op.data.payload ?? '');
			// New router format
			if (
				parsed?.type === 'swap' &&
				parsed?.asset_in &&
				parsed?.asset_out &&
				parsed?.amount_in != null
			) {
				return {
					asset0: String(parsed.asset_in).toLowerCase(),
					amount0: String(parsed.amount_in),
					asset1: String(parsed.asset_out).toLowerCase(),
					// min_amount_out is a floor; fall back to '0' if absent
					amount1: String(parsed.min_amount_out ?? '0')
				};
			}
			// Old pool format
			if (parsed?.asset0 && parsed?.asset1 && parsed?.amount0 != null && parsed?.amount1 != null) {
				return parsed as { asset0: string; amount0: string; asset1: string; amount1: string };
			}
		} catch {}
		return null;
	});

	const isSwap = $derived(op.data.action === 'execute' && swapPayload !== null);

	// For swaps: fromAmount = what user sends (asset0), amount = what user receives (asset1).
	// For other contract calls: amount comes from intents limit.
	const fromAmount = $derived(
		isSwap && swapPayload
			? new CoinAmount(
					swapPayload.amount0,
					Coin[swapPayload.asset0.split('_')[0] as keyof typeof Coin] || Coin.unk,
					true
				)
			: null
	);
	const amount = $derived.by(() => {
		if (isSwap && swapPayload) {
			return new CoinAmount(
				swapPayload.amount1,
				Coin[swapPayload.asset1.split('_')[0] as keyof typeof Coin] || Coin.unk,
				true
			);
		}
		const intents = op.data.intents;
		const amt = intents?.[0]?.args?.limit ?? '0';
		const coinVal = intents?.[0]?.args?.token ?? Coin.hive.value;
		return new CoinAmount(amt, Coin[coinVal.split('_')[0] as keyof typeof Coin] || Coin.hive, true);
	});

	let inUsd = $state('');
	$effect(() => {
		amount.convertTo(Coin.usd, Network.lightning).then((a) => {
			inUsd = a.toAmountString();
		});
	});

	const displayType: string = $derived.by(() => {
		if (isSwap) return 'swap';
		try {
			const payloadStr = op.data.payload;
			if (typeof payloadStr === 'string') {
				const parsed = JSON.parse(payloadStr);
				if (parsed?.type) return parsed.type.replace(/_/g, ' ');
			}
		} catch {}
		return op.data.action ?? op.type ?? 'call';
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
	<Amount {amount} {fromAmount} direction={isSwap ? 'swap' : 'contract'} />
	<Type direction={isSwap ? 'swap' : 'contract'} t={displayType} />
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
			{:else}
				{amount.toPrettyString()}
			{/if}
			<span class="approx-usd">
				Approx. ${inUsd} USD
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
