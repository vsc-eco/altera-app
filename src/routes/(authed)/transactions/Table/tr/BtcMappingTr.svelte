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
	import Party from '../tds/Party.svelte';
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
	import { getAccountNameFromDid } from '$lib/getAccountName';

	type Props = {
		tx: TransactionInter;
		op: TransactionOpType;
		/** The account the table lists; defaults to the signed-in one. */
		viewDid?: string;
		onRowClick: (op: [string, number], content: () => ReturnType<Snippet>) => void;
	};
	let { tx, op, viewDid, onRowClick }: Props = $props();

	let loaded = $state(false);
	let indexerEvent = $state<BtcMappingEventResult>(null);
	let fromAccount = $state('');
	let toAccount = $state('');

	const did = $derived(viewDid ?? getAuth()().value?.did ?? '');
	/**
	 * Who signed the call — the caller the contract itself debits, and the one
	 * party a transaction always states. The fallbacks below used to answer
	 * "the account being viewed", which is only the sender when the viewer
	 * happens to be it: risingstarhub's transfer to jef-001, read on jef-001's
	 * page, came out as "jef-001 → jef-001".
	 */
	const signer = $derived(tx.required_auths?.[0] ?? '');
	const { anchr_height: block_height } = $derived(tx);

	const contractInfo = $derived.by(() => {
		let payload = op.data;
		if (typeof payload.json === 'string') {
			payload = JSON.parse(payload.json);
		}

		const action = payload.action;
		// A transfer is only outgoing for the account that SENT it. On the
		// recipient's page it is money coming in, and the row printed it as a
		// debit ("-0.00030000 BTC") of an account that had just been paid.
		const received = !!did && toAccount === did && fromAccount !== did;
		if (action === 'unmap') {
			return { action, displayType: 'withdraw', direction: 'outgoing' as const };
		} else if (action === 'transfer') {
			return {
				action,
				displayType: 'transfer',
				direction: (received ? 'incoming' : 'outgoing') as 'incoming' | 'outgoing'
			};
		} else if (action === 'transferFrom') {
			return {
				action,
				displayType: 'transfer from',
				direction: (received ? 'incoming' : 'outgoing') as 'incoming' | 'outgoing'
			};
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
					fromAccount = result.event.from_addr || signer || did;
					// to_addr is null on older unmap rows — fall back to the original
					// call payload's `to` field (the BTC destination address).
					toAccount = result.event.to_addr || payloadData?.to || 'Unknown';
				} else if (result.action === 'map') {
					// deposit table names its parties sender/recipient
					fromAccount = result.event.sender || signer || did;
					toAccount = result.event.recipient || 'Unknown';
				} else {
					// transfer / transferFrom (VSC → VSC) — the transfer table uses
					// from_addr/to_addr, same as unmap.
					fromAccount = result.event.from_addr || signer || did;
					toAccount = result.event.to_addr || payloadData?.to || 'Unknown';
				}
			} else {
				// No indexer row yet. Internal transfers DO emit a
				// btc_mapping_transfer_events row, but it can lag the contract-state
				// finality (and map/unmap rows can also be briefly absent), so fall
				// back to what we can read directly from the payload meanwhile.
				fromAccount = signer || did;
				toAccount = payloadData?.to ?? 'Unknown';
			}
		} catch (e) {
			console.error('Failed to load BTC mapping indexer data', e);
			fromAccount = signer || did;
			toAccount = payloadData?.to ?? 'Unknown';
		}
		loaded = true;
	}

	// Run after auth resolves so `did` is populated for the fromAccount fallback.
	// Re-runs if auth changes (e.g. wallet switch), resetting loaded so the drawer
	// shows "Loading details..." rather than stale data from the previous account.
	$effect(() => {
		if (!did) return; // wait for auth to settle
		signer; // re-read when the transaction's signer lands
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
		// Sats ARE BTC's base unit (8 dp), so hand them over as they are. Going
		// via satsToBtc built a float first ("0.00030000000000000003") and only
		// the parser's truncation put it back.
		return new CoinAmount(Number(sats) || 0, Coin.btc, true);
	});

	let inUsd = $state('');
	$effect(() => {
		displayAmount.convertTo(Coin.usd, Network.lightning).then((amount) => {
			inUsd = amount.toAmountString();
		});
	});

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
	<PopupTitleRow title={popupTitle} status={tx.status} {tx} opIndex={op.index} />
	<p class="popup-subtitle">
		{moment(getTimestamp(tx)).format('MMM DD, YYYY [at] H:mm')}
		{#if fromAccount} · {getAccountNameFromDid(fromAccount)} → {toAccount === 'Unknown'
				? 'Unknown'
				: getAccountNameFromDid(toAccount)}{/if}
	</p>
	<div class="sections">
		{#if !loaded}
			<p>Loading details...</p>
		{:else}
			<div class="amount">
				<!-- Through CoinAmount, not the raw number: satsToBtc divides by
				     1e8 in binary floating point, so 30,000 sats printed as
				     "0.00030000000000000003 BTC". -->
				{displayAmount.toPrettyAmountString()} BTC
				<span class="approx-usd"> Approx. ${inUsd} USD </span>
			</div>

			{#if indexerEvent?.action === 'unmap'}
				{@const fee = Number(indexerEvent.event.deducted) - Number(indexerEvent.event.sent)}
				{#if fee > 0}
					<div class="section">
						<h3>Amount Sent</h3>
						<div class="copyable-text">
							{new CoinAmount(Number(indexerEvent.event.sent) || 0, Coin.btc, true)
								.toPrettyAmountString()} BTC
						</div>
					</div>
					<div class="section">
						<h3>Bridge Fee</h3>
						<div class="copyable-text">
							{new CoinAmount(fee, Coin.btc, true).toPrettyAmountString()} BTC
						</div>
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
					<!-- The op's own contract, not the constant: naming the BTC
					     mapping contract on a call that went somewhere else
					     makes the popup state something untrue. -->
					<BasicCopy value={op.data?.contract_id || BTC_MAPPING_CONTRACT_ID} />
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
	<Party account={fromAccount} />
	<Party account={toAccount && toAccount !== 'Unknown' ? toAccount : undefined} />
	<Status status={tx.status} {tx} opIndex={op.index} />
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
