<script lang="ts">
	import Date from '../tds/Date.svelte';
	import ToFrom from '../tds/ToFrom.svelte';
	import Amount from '../tds/Amount.svelte';
	import Token from '../tds/Token.svelte';
	import Type from '../tds/Type.svelte';
	import { portal, normalizeProps, useMachine } from '@zag-js/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import Card from '$lib/cards/Card.svelte';
	import { ExternalLink, X } from '@lucide/svelte';
	import StatusView from './StatusView.svelte';
	import { Coin, Network } from '$lib/send/sendOptions';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
	import { untrack } from 'svelte';
	import { getAuth } from '$lib/auth/store';
	import { checkOpStatus } from './checkStatus';
	import type { TransactionInter, TransactionOpType } from '../../txStores';
	import moment from 'moment';
	import SidePopup from '$lib/sidePopup/SidePopup.svelte';

	type Props = {
		tx: TransactionInter;
		op: TransactionOpType;
		ledgerIndex?: number;
		openOp: [string, number] | null;
		onRowClick: (op: [string, number]) => void;
	};
	let { tx, op, ledgerIndex, openOp, onRowClick }: Props = $props();
	const did = $derived(getAuth()().value!.did);
	const { ledger, anchr_height: block_height, anchr_ts, status } = $derived(tx);
	const { data } = $derived(op);
	const anchor_ts = $derived(anchr_ts + 'Z');
	const {
		from,
		to,
		coinAmount: amount,
		type: t,
		memo,
		memoNoId
	}: Omit<NonNullable<typeof ledger>[number], 'memo'> & {
		coinAmount: UnkCoinAmount;
		memo: URLSearchParams | null;
		memoNoId: URLSearchParams | null;
	} = $derived.by(() => {
		const source = ledger && ledgerIndex ? ledger[ledgerIndex] : data;
		const memo = source.memo ? new URLSearchParams(data.memo) : null;
		const memoNoId = memo ? new URLSearchParams(memo) : null;
		memoNoId?.delete('altera_id');
		if (ledger == null || ledgerIndex == undefined) {
			return {
				...data,
				memo: memo,
				memoNoId: memoNoId,
				coinAmount: new CoinAmount(
					data.amount,
					Coin[data.asset.split('_')[0] as keyof typeof Coin] || Coin.unk,
					typeof data.amount == 'number' // whether the number is preshifted (i.e. int without decimal)
				),
				type: op.type
			};
		} else {
			const out = ledger[ledgerIndex];
			return {
				...out,
				memo: memo,
				memoNoId: memoNoId,
				coinAmount: new CoinAmount(
					out.amount,
					Coin[out.asset.split('_')[0] as keyof typeof Coin],
					true
				)
			};
		}
	});
	$inspect(status);

	console.log('statusquery - tx', tx);
	console.log(
		'statusquery - condition',
		!tx.isPending && !['CONFIRMED', 'FAILED'].includes(tx.status)
	);

	const statusStore = $derived(
		tx.isPending || ['CONFIRMED', 'FAILED'].includes(tx.status)
			? null
			: checkOpStatus(tx.id, tx.status)
	);

	$effect(() => {
		if (!statusStore) return;
		return untrack(() => statusStore).subscribe((status) => {
			if (tx.status != status) {
				tx = { ...tx, status };
			}
		});
	});

	// console.log("isPending, memo", tx.isPending, memo);

	const otherAccount = $derived(
		to == from
			? t.includes('unstake')
				? from!
				: t.includes('stake')
					? to!
					: to!
			: to == did
				? from!
				: to!
	);
	let inUsd = $state('');
	$effect(() => {
		amount.convertTo(Coin.usd, Network.lightning).then((amount) => {
			inUsd = amount.toAmountString();
		});
	});

	let detailsOpen = $state(false);
	function handleTrigger() {
		onRowClick([tx.id, op.index]);
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTrigger();
			e.preventDefault();
		}
	}
	let toggle: (open?: boolean) => void = $state(() => {});
	$effect(() => {
		detailsOpen = openOp !== null && openOp[0] === tx.id && openOp[1] === op.index;
	});
</script>

<tr
	data-tx-id={tx.id}
	tabindex="0"
	onclick={handleTrigger}
	onkeydown={handleKeydown}
	class="clickable-row"
>
	<td class="date">{moment(anchor_ts).format('MMM DD')}</td>
	<ToFrom {otherAccount} memo={memoNoId?.toString()} {status} />
	<Amount {amount} />
	<Token {amount} />
	<Type isIncoming={!amount.isNegative()} {t} />
</tr>

<SidePopup bind:toggle bind:open={detailsOpen} defaultOpen={false}>
	{#snippet content()}
		<h2>
			{t
				.replace('_', ' ')
				.replace(
					/\w\S*/g,
					(text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
				)}
		</h2>
		<div class="amount">
			{amount.toPrettyString()}
			<span class="approx-usd">
				Approx. ${inUsd} USD
			</span>
		</div>

		<StatusView
			{anchor_ts}
			memo={memo?.toString() || undefined}
			{from}
			{to}
			{status}
			{block_height}
		/>
		<div class="sections">
			{#if memo}
				<div class="memo section">
					<h3>Memo</h3>
					<p>{memo}</p>
				</div>
			{/if}
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
					<a
						href={'https://www.hiveblockexplorer.com/tx/' + tx.id}
						target="_blank"
						rel="noreferrer"
					>
						Hive Block Explorer<ExternalLink /></a
					>
				</div>
			</div>
		</div>
	{/snippet}
</SidePopup>

<style>
	tr:hover,
	tr {
		cursor: pointer;
		transition: background-color 1s;
		animation: highlight-in 1s both;
	}

	.amount {
		font-size: var(--text-4xl);
		margin: 1rem 0;
	}
	.approx-usd {
		display: block;
		text-wrap: wrap;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
		margin-top: 0.5rem;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	a :global(svg) {
		width: 16px;
	}

	h2 {
		margin-top: 0 !important;
	}

	.section h3 {
		font-size: var(--text-sm);
		font-weight: 600;
		margin-top: 0;
	}
	.memo p {
		/* min-height: 2rem; */
		display: flex;
		padding-top: 0.25rem;
	}
	.misc.section {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.section {
		padding: 0.5rem;
		border-radius: 0.5rem;
		position: relative;
		flex-shrink: 0;
		flex-basis: auto;
		/* width: max-content; */
	}
	.sections {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		/* align-items: stretch; */
		flex: 1;
		gap: 0.5rem;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tx-id.section {
		margin-top: auto;
	}

	.links-disabled a {
		pointer-events: none;
		color: var(--neutral-mid) !important;
		text-decoration: none !important;
		filter: grayscale(50%);
	}

	.date {
		vertical-align: middle;
		padding: 1rem min(1rem, 2%);
		width: max-content;
		border-bottom: 1px solid var(--neutral-bg-accent);
		min-width: 4rem;
	}
</style>
