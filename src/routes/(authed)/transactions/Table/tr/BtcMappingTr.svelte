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
	import Token from '../tds/Token.svelte';
	import ToFrom from '../tds/ToFrom.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromDid } from '$lib/getAccountName';
	import StatusView from './StatusView.svelte';
	import { AccHistoryStore, DagByCIDStore } from '$houdini';

	type Details = {
		net_id?: string;
		contract_id?: string;
		action?: string;
		payload?: {
			amount?: number;
			recipient_btc_address?: string;
			tx_data?: {
				block_height?: number;
				tx_index?: number;
				instructions?: string[];
			};
		};
		rc_limit?: number;
		intents?: any[];
	};

	type Props = {
		tx: TransactionInter;
		op: TransactionOpType;
		onRowClick: (op: [string, number], content: () => ReturnType<Snippet>) => void;
	};
	let { tx, op, onRowClick }: Props = $props();

	let loading = $state(true);
	let details = $state<Details | null>(null);
	let outputId = $state('');
	let error = $state('');
	let statusValues = $state('');
	let result = $state<any>(null);
	let fromAccount = $state('');
	let toAccount = $state('');

	const did = $derived(getAuth()().value!.did);

	const { anchr_height: block_height } = $derived(tx);

	const contractInfo = $derived.by(() => {
	try {
		let payload = op.data;
		if (typeof payload.json === 'string') {
			payload = JSON.parse(payload.json);
		}

		const action = payload.action;
		if (action === 'map') {
			return { action, displayType: 'deposit', direction: 'incoming' as const };
		} else if (action === 'unmap') {
			return { action, displayType: 'withdraw', direction: 'outgoing' as const };
		}
	} catch (e) {
		console.error('Failed to determine contract action in ContractTr', e);
	}
	return {
		action: '',
		displayType: formatOpType(op.type ?? tx.type),
		direction: 'contract' as const
	};
});

	/**
	 * Extract operation data from GraphQL op.data field.
	 * GraphQL's op.data is a Map type that may contain the operation JSON directly
	 * or wrapped in a 'json' property as a string.
	 */
	function extractOpDataFromGraphQL(opData: any): any | null {
		if (!opData) return null;
		
		try {
			// Check if data is already parsed (object with action, contract_id, etc.)
			if (opData.action && typeof opData === 'object') {
				return opData;
			}
			
			// Check if data has a 'json' property that needs parsing
			if (typeof opData.json === 'string') {
				return JSON.parse(opData.json);
			}
			
			// Try to use data directly if it looks like operation data
			if (opData.contract_id || opData.action) {
				return opData;
			}
		} catch (e) {
			console.error('Failed to extract op data from GraphQL', e);
		}
		
		return null;
	}

	async function loadDetails() {
		error = '';
		try {
			// Fetch GraphQL data first
			const gqlRes = await new AccHistoryStore().fetch({
				variables: { opts: { byId: tx.id, offset: 0, limit: 1 } },
				policy: 'NetworkOnly'
			});

			if (!gqlRes.data) throw new Error('GraphQL fetch failed');

			const txns = gqlRes.data?.txns;
			if (!txns || txns.length === 0) throw new Error('No transaction data found');

			const txn = txns[0];
			const opData = txn.ops?.[op.index]?.data;
			
			// Try to extract operation data from GraphQL first
			let parsed = extractOpDataFromGraphQL(opData);
			let needsHafApi = false;

			// Check if we have all required fields from GraphQL
			if (!parsed || !parsed.action || !parsed.contract_id) {
				// Missing critical fields, need to fetch from HAF API
				needsHafApi = true;
			}

			// Fetch HAF API data if needed (for net_id, intents, or complete payload structure)
			let hafData: any = null;
			if (needsHafApi || !parsed.net_id || !parsed.intents || !parsed.payload) {
				try {
					const hafRes = await fetch(`https://techcoderx.com/hafah-api/transactions/${tx.id}?include-virtual=true`);
					if (hafRes.ok) {
						hafData = await hafRes.json();
						const opJson = hafData.transaction_json?.operations?.[op.index]?.value?.json;
						if (opJson) {
							const hafParsed = JSON.parse(opJson);
							// Merge HAF API data with GraphQL data (HAF API takes precedence for missing fields)
							parsed = {
								...parsed,
								net_id: hafParsed.net_id ?? parsed?.net_id,
								contract_id: hafParsed.contract_id ?? parsed?.contract_id,
								action: hafParsed.action ?? parsed?.action,
								payload: hafParsed.payload ?? parsed?.payload,
								rc_limit: hafParsed.rc_limit ?? parsed?.rc_limit ?? txn.rc_limit,
								intents: hafParsed.intents ?? parsed?.intents
							};
						}
					}
				} catch (e) {
					console.warn('HAF API fetch failed, using GraphQL data only', e);
					// Continue with GraphQL data only
				}
			}

			// Use rc_limit from GraphQL if available (more reliable)
			if (!parsed) {
				throw new Error('Failed to extract operation data');
			}

			parsed.rc_limit = parsed.rc_limit ?? txn.rc_limit;

			let payloadContent: Details['payload'];
			if (parsed.payload && typeof parsed.payload === 'string' && parsed.payload.trim()) {
				try {
					payloadContent = JSON.parse(parsed.payload);
				} catch (e) {
					console.error('Failed to parse payload JSON string:', parsed.payload, e);
					error = 'Failed to parse transaction payload.';
				}
			} else if (parsed.payload && typeof parsed.payload === 'object') {
				payloadContent = parsed.payload;
			}

			// Get amount from GraphQL ledger_actions (more reliable than HAF API)
			if (payloadContent && parsed.action === 'map' && txn.ledger_actions && txn.ledger_actions.length > 0) {
				const depositAction = txn.ledger_actions.find(
					(a: any) => a.type === 'deposit' && a.asset === 'sat'
				);
				if (depositAction) {
					payloadContent.amount = depositAction.amount ?? 0;
				}
			}

			details = {
				net_id: parsed.net_id,
				contract_id: parsed.contract_id,
				action: parsed.action,
				payload: payloadContent,
				rc_limit: parsed.rc_limit,
				intents: parsed.intents
			};

			if (details.action === 'unmap') {
				fromAccount = did;
				toAccount = details.payload?.recipient_btc_address ?? 'Unknown';
			} else if (details.action === 'map') {
				fromAccount = 'Bitcoin Network';
				const instruction = details.payload?.tx_data?.instructions?.[0];
				if (instruction) {
					try {
						const params = new URLSearchParams(instruction);
						const depositTo = params.get('deposit_to') ?? '';
						if (depositTo) {
							toAccount = getUsernameFromDid(depositTo);
						} else {
							toAccount = 'Unknown';
						}
					} catch (e) {
						console.error('Failed to parse instruction params:', instruction, e);
						toAccount = 'Unknown';
					}
				} else {
					toAccount = 'Unknown';
				}
			}

			const fetchedOutputId = txn?.output?.[0]?.id;
			outputId = fetchedOutputId || '';
			statusValues = txn?.status || '';
			if (fetchedOutputId) {
				const dagRes = await new DagByCIDStore().fetch({
					variables: { cid0: fetchedOutputId },
					policy: 'NetworkOnly'
				});
				if (dagRes.data) {
					const d0 = dagRes.data?.d0;
					if (d0) {
						const outputData = JSON.parse(d0);
						if (outputData.results && outputData.results.length > 0) {
							const firstResult = outputData.results[0];
							if (firstResult.ok) {
								result = firstResult;
							} else {
								if (outputData.results.length >= 3) {
									result = outputData.results[2];
								} else if (outputData.results.length >= 2) {
									result = outputData.results[1];
								} else {
									result = firstResult;
								}
							}
						}
					}
				} else {
					error = 'Failed to load DAG details';
				}
			}
		} catch (e) {
			error = 'Failed to load details';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	loadDetails();

	function handleTrigger() {
		onRowClick([tx.id, op.index], contractRowContent);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleTrigger();
		}
	}

	const displayAmount = $derived.by(() => {
		if (details?.payload?.amount) {
			const btcAmount = satsToBtc(details.payload.amount);
			return new CoinAmount(btcAmount.toString(), Coin.btc, true);
		}
		return new CoinAmount('0', Coin.btc, true);
	});
	let inUsd = $state('');
	$effect(() => {
		displayAmount.convertTo(Coin.usd, Network.lightning).then((amount) => {
			inUsd = amount.toAmountString();
		});
	});

	/**
	 * Parse an `errMsg` returned by contract execution and return the concise human message.
	 * Examples:
	 * - "msg: sender balance insufficient. has 0, needs 5000\nfile: :64500:64500" => "sender balance insufficient. has 0, needs 5000"
	 * - "msg: EOF\nfile: :64500:64500" => "EOF"
	 */
	function parseErrMsg(errMsg?: string) {
		if (!errMsg) return '';
		const lines = errMsg.split('\n').map((l) => l.trim()).filter(Boolean);
		for (const line of lines) {
			if (/^msg:/i.test(line)) return line.replace(/^msg:\s*/i, '').trim();
			if (/^err:/i.test(line)) return line.replace(/^err:\s*/i, '').trim();
		}
		const nonFile = lines.find((l) => !/^file:/i.test(l));
		return (nonFile || lines[0] || '').replace(/^msg:\s*/i, '').replace(/^err:\s*/i, '').trim();
	}
	const otherAccount = $derived(toAccount === did || !toAccount ? fromAccount : toAccount);
</script>

<tr
	data-tx-id={tx.id}
	tabindex="0"
	onclick={handleTrigger}
	onkeydown={handleKeydown}
	class="clickable-row"
>
	<td class="date">{moment(getTimestamp(tx)).format('MMM DD')}</td>
	<ToFrom {otherAccount} status={tx.status} />
	<Amount amount={displayAmount} direction={contractInfo.direction} />
	<Token amount={displayAmount} direction={contractInfo.direction} />

	<Type direction={contractInfo.direction} t={contractInfo.displayType} />
</tr>

{#snippet contractRowContent()}
	<span>
		{#if details?.action === 'map'}
			<h2>Deposit</h2>
		{:else if details?.action === 'unmap'}
			<h2>Withdrawal</h2>
		{:else}
			<h2>
				{(op.type ?? tx.type)
					.replace('_', ' ')
					.replace(
						/\w\S*/g,
						(text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
					)}
			</h2>
		{/if}
	</span>
	<div class="sections">
		{#if loading}
			<p>Loading details...</p>
		{:else if error}
			<p class="error">{error}</p>

			{#if details?.contract_id}
				<div class="contract-id section">
					<h3>Contract ID</h3>
					<div class="copyable-text">
						<BasicCopy value={details.contract_id} />
					</div>
				</div>
			{/if}

			<div class="section">
				<h3>Transaction Id</h3>
				<div class="copyable-text">
					<BasicCopy value={tx.id} />
				</div>
			</div>
			<div class="links section">
				<h3>External Links</h3>
				<div class={`links ${tx.isPending ? 'links-disabled' : ''}`}>
					<a href={'https://api.vsc.eco/tx/' + tx.id} target="_blank" rel="noreferrer">
						VSC Block Explorer<ExternalLink /></a
					>
				</div>
			</div>

		{:else}
			<div class="amount section">
				{satsToBtc(details?.payload?.amount || 0)} BTC
				<span class="approx-usd"> Approx. ${inUsd} USD </span>
			</div>
			<StatusView
				anchor_ts={getTimestamp(tx)}
				from={fromAccount}
				to={toAccount}
				status={statusValues}
				block_height={block_height ?? details?.payload?.tx_data?.block_height ?? 0}
				memo=""
			/>

			{#if result}
				<div class="section">
					<h3>Message</h3>
					{#if result.ok}
						<span class="success">{result.ret || 'Success'}</span>
					{:else}
						<span class="error">
							{parseErrMsg(result.errMsg) || result.err || 'Error'}
						</span>
					{/if}
				</div>
			{/if}

			{#if details?.payload?.recipient_btc_address}
				<div class="section">
					<h3>Recipient BTC Address</h3>
					<div class="copyable-text">
						<BasicCopy value={details.payload.recipient_btc_address} />
					</div>
				</div>
			{/if}

			{#if details?.payload?.tx_data && details.action === 'map'}
				<div class="section">
					<h3>Deposit TX Data</h3>
					<p>Block Height: {details.payload.tx_data.block_height}</p>
					<p>TX Index: {details.payload.tx_data.tx_index}</p>
					<p>Instructions: {details.payload.tx_data.instructions?.join(', ')}</p>
				</div>
			{/if}

			{#if details?.contract_id}
				<div class="contract-id section">
					<h3>Contract ID</h3>
					<div class="copyable-text">
						<BasicCopy value={details.contract_id} />
					</div>
				</div>
			{/if}

			<div class="section">
				<h3>Transaction Id</h3>
				<div class="copyable-text">
					<BasicCopy value={tx.id} />
				</div>
			</div>
			<div class="links section">
				<h3>External Links</h3>
				<div class={`links ${tx.isPending ? 'links-disabled' : ''}`}>
					<a href={'https://api.vsc.eco/tx/' + tx.id} target="_blank" rel="noreferrer">
						VSC Block Explorer<ExternalLink /></a
					>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

<style>
	tr:hover,
	tr {
		cursor: pointer;
		transition: background-color 1s;
		animation: highlight-in 1s both;
	}
	h2 {
		margin-top: 0 !important;
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
	.date {
		vertical-align: middle;
		padding: 1rem min(1rem, 2%);
		width: max-content;
		border-bottom: 1px solid var(--neutral-bg-accent);
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
		border-radius: 0.5rem;
		position: relative;
		flex-shrink: 0;
		flex-basis: auto;
		/* width: max-content; */
	}
	.sections {
		display: flex;
		flex-direction: column;
		/* align-items: stretch; */
		flex: 1;
		gap: 0.5rem;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.links.section {
		display: inline;
	}

	.contract-id.section {
		margin-top: auto;
	}


	.success {
		/* min-height: 2rem; */
		display: flex;
		padding-top: 0.25rem;
		word-wrap: break-word;
		overflow-wrap: break-word;
		word-break: break-word; /* This tries to break at word boundaries first */
		white-space: pre-wrap;
		max-width: 100%;
	}

	.copyable-text {
		font-size: var(--text-sm);
		word-break: break-all;
	}
</style>
