<script lang="ts">
	import {
		getTimestamp,
		type TransactionInter,
		type TransactionOpType,
		formatOpType
	} from '$lib/stores/txStores';
	import moment from 'moment';
	import type { Snippet } from 'svelte';
	import Type from '../tds/Type.svelte';
	import { ExternalLink } from '@lucide/svelte';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import Amount from '../tds/Amount.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { satsToBtc } from '$lib/sendswap/utils/units';
	import ToFrom from '../tds/ToFrom.svelte';
	import Status from '../tds/Status.svelte';
	import { getAuth } from '$lib/auth/store';
	import StatusView from './StatusView.svelte';
	import {
		fetchBtcMappingEvent,
		type BtcMappingEventResult,
		type BtcMappingAction
	} from '$lib/indexer/btcMappingQueries';
	import { BTC_MAPPING_CONTRACT_ID, getVscExplorerTxUrl, getMemPoolTxUrl } from '$lib/constants';
	import PopupTitleRow from './PopupTitleRow.svelte';

	type Props = {
		tx: TransactionInter;
		op: TransactionOpType;
		onRowClick: (op: [string, number], content: () => ReturnType<Snippet>) => void;
	};
	let { tx, op, onRowClick }: Props = $props();

	let loaded = $state(false);
	let indexerEvent = $state<BtcMappingEventResult>(null);
	let fromAccount = $state('');
	let toAccount = $state('');

	const did = $derived(getAuth()().value?.did ?? '');
	const { anchr_height: block_height } = $derived(tx);

	const contractInfo = $derived.by(() => {
		let payload = op.data;
		if (typeof payload.json === 'string') {
			payload = JSON.parse(payload.json);
		}

		const action = payload.action;
		if (action === 'unmap') {
			return { action, displayType: 'withdraw', direction: 'outgoing' as const };
		} else if (action === 'transfer') {
			return { action, displayType: 'transfer', direction: 'outgoing' as const };
		} else if (action === 'transferFrom') {
			return { action, displayType: 'transfer from', direction: 'outgoing' as const };
		}
		return {
			action: '',
			displayType: formatOpType(op.type ?? tx.type),
			direction: 'contract' as const
		};
	});

	const popupTitle = $derived.by(() => {
		if (contractInfo.action === 'unmap') return 'Withdrawal';
		if (contractInfo.action === 'transfer') return 'Transfer';
		if (contractInfo.action === 'transferFrom') return 'Transfer From';
		return (op.type ?? tx.type)
			.replace('_', ' ')
			.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase());
	});

	// Fallback payload parsed from op.data — used while the indexer query is in flight
	// and as a permanent fallback for internal VSC transfers that have no indexer event.
	//
	// Two payload shapes exist:
	//   Plain JSON string  → op.data.payload = '{"amount":"432","to":"hive:v4vapp-test"}'
	//   Legacy base64 obj  → op.data.payload = { Data: "<base64>" }
	const payloadData = $derived.by(() => {
		try {
			const raw = op.data?.payload;
			// Most common: plain JSON string (all new call/transfer and call/unmap ops)
			if (typeof raw === 'string') {
				return JSON.parse(raw) as { amount?: string; to?: string } | null;
			}
			// Legacy: payload is an object with a base64-encoded Data field
			const payloadDataBase64 = raw?.Data;
			if (!payloadDataBase64 || typeof payloadDataBase64 !== 'string') return null;
			let decoded = atob(payloadDataBase64);
			if (!decoded || decoded.trim() === '') return null;
			let parsed = JSON.parse(decoded);
			if (typeof parsed === 'string' && parsed.trim() !== '') {
				try {
					parsed = JSON.parse(parsed);
				} catch {
					return null;
				}
			}
			return parsed;
		} catch {
			return null;
		}
	});

	async function loadIndexerData() {
		const action = contractInfo.action as BtcMappingAction | '';
		if (!action) {
			loaded = true;
			return;
		}

		try {
			const result = await fetchBtcMappingEvent(tx.id, action);
			if (result) {
				indexerEvent = result;
				if (result.action === 'unmap') {
					fromAccount = result.event.from_addr || did;
					// to_addr is null on older unmap rows — fall back to the original
					// call payload's `to` field (the BTC destination address).
					toAccount = result.event.to_addr || payloadData?.to || 'Unknown';
				} else {
					fromAccount = result.event.sender || did;
					toAccount = result.event.recipient || 'Unknown';
				}
			} else {
				// No indexer entry — internal VSC transfers (call/transfer) never produce
				// an on-chain BTC event so the indexer will always return null for them.
				// Fall back to what we can read directly from the payload.
				fromAccount = did;
				toAccount = payloadData?.to ?? 'Unknown';
			}
		} catch (e) {
			console.error('Failed to load BTC mapping indexer data', e);
			fromAccount = did;
			toAccount = payloadData?.to ?? 'Unknown';
		}
		loaded = true;
	}

	// Run after auth resolves so `did` is populated for the fromAccount fallback.
	// Re-runs if auth changes (e.g. wallet switch), resetting loaded so the drawer
	// shows "Loading details..." rather than stale data from the previous account.
	$effect(() => {
		if (!did) return; // wait for auth to settle
		loaded = false;
		loadIndexerData();
	});

	// Amount: prefer indexer, fall back to op.data payload while loading.
	// For unmap: use `deducted` (total cost to user). For transfer: use `amount`.
	const displayAmount = $derived.by(() => {
		let sats: string | number;
		if (indexerEvent?.action === 'unmap') {
			sats = indexerEvent.event.deducted;
		} else if (indexerEvent?.action === 'transfer' || indexerEvent?.action === 'transferFrom') {
			sats = indexerEvent.event.amount;
		} else {
			sats = payloadData?.amount || 0;
		}
		return new CoinAmount(satsToBtc(Number(sats)).toString(), Coin.btc, true);
	});

	let inUsd = $state('');
	$effect(() => {
		displayAmount.convertTo(Coin.usd, Network.lightning).then((amount) => {
			inUsd = amount.toAmountString();
		});
	});

	const otherAccount = $derived(toAccount === did || !toAccount ? fromAccount : toAccount);

	function handleTrigger() {
		onRowClick([tx.id, op.index], contractRowContent);
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleTrigger();
		}
	}
</script>

{#snippet contractRowContent()}
	<PopupTitleRow title={popupTitle} status={tx.status} />
	<p class="popup-subtitle">
		{moment(getTimestamp(tx)).format('MMM DD, YYYY [at] H:mm')}
		{#if fromAccount} · {fromAccount} → {toAccount}{/if}
	</p>
	<div class="sections">
		{#if !loaded}
			<p>Loading details...</p>
		{:else}
			<div class="amount">
				{#if indexerEvent?.action === 'unmap'}
					{satsToBtc(Number(indexerEvent.event.deducted))} BTC
				{:else if indexerEvent?.action === 'transfer' || indexerEvent?.action === 'transferFrom'}
					{satsToBtc(Number(indexerEvent.event.amount))} BTC
				{:else}
					{satsToBtc(Number(payloadData?.amount || 0))} BTC
				{/if}
				<span class="approx-usd"> Approx. ${inUsd} USD </span>
			</div>

			{#if indexerEvent?.action === 'unmap'}
				{@const fee = Number(indexerEvent.event.deducted) - Number(indexerEvent.event.sent)}
				{#if fee > 0}
					<div class="section">
						<h3>Amount Sent</h3>
						<div class="copyable-text">{satsToBtc(Number(indexerEvent.event.sent))} BTC</div>
					</div>
					<div class="section">
						<h3>Bridge Fee</h3>
						<div class="copyable-text">{satsToBtc(fee)} BTC</div>
					</div>
				{/if}
			{/if}

			<StatusView
				anchor_ts={getTimestamp(tx)}
				from={fromAccount}
				to={toAccount}
				status=""
				block_height={block_height ?? 0}
				memo=""
			/>

			{#if toAccount}
				<div class="section">
					<h3>{contractInfo.action === 'unmap' ? 'Recipient Address' : 'Recipient'}</h3>
					<div class="copyable-text">
						<BasicCopy value={toAccount} />
					</div>
				</div>
			{/if}

			{#if indexerEvent?.action === 'unmap' && indexerEvent.event.tx_id}
				<div class="section">
					<h3>Bitcoin Transaction</h3>
					<div class="copyable-text">
						<BasicCopy value={indexerEvent.event.tx_id} />
					</div>
				</div>
			{/if}

			{#if contractInfo.action === 'transferFrom' && fromAccount}
				<div class="section">
					<h3>Source Account</h3>
					<div class="copyable-text">
						<BasicCopy value={fromAccount} />
					</div>
				</div>
			{/if}

			<div class="contract-id section">
				<h3>Contract ID</h3>
				<div class="copyable-text">
					<BasicCopy value={BTC_MAPPING_CONTRACT_ID} />
				</div>
			</div>

			<div class="tx-id section">
				<h3>Transaction Id</h3>
				<div class="copyable-text">
					<BasicCopy value={tx.id} />
				</div>
			</div>
			<div class="links section">
				<h3>External Links</h3>
				<div class={`links ${tx.isPending ? 'links-disabled' : ''}`}>
					<a href={getVscExplorerTxUrl(tx.id)} target="_blank" rel="noreferrer">
						VSC Block Explorer<ExternalLink />
					</a>
					{#if indexerEvent?.action === 'unmap' && indexerEvent.event.tx_id}
						<a href={getMemPoolTxUrl(indexerEvent.event.tx_id)} target="_blank" rel="noreferrer">
							BTC Block Explorer<ExternalLink />
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/snippet}

<tr
	data-tx-id={tx.id}
	tabindex="0"
	onclick={handleTrigger}
	onkeydown={handleKeydown}
	class="clickable-row"
>
	<td class="date">{moment(getTimestamp(tx)).format('MMM DD')}</td>
	<ToFrom {otherAccount} />
	<Status status={tx.status} />
	<Amount amount={displayAmount} direction={contractInfo.direction} />
	<Type direction={contractInfo.direction} t={contractInfo.displayType} />
</tr>

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
		flex: 1;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.tx-id.section {
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

	.contract-id.section {
		margin-top: auto;
	}

	.copyable-text {
		font-size: var(--text-sm);
		word-break: break-all;
	}
</style>
