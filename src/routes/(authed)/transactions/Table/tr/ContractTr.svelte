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
	import StatusView from './StatusView.svelte';

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

	const GRAPHQL_QUERY = `query AccHistory ($opts: TransactionFilter) { txns: findTransaction(filterOptions: $opts) { id anchr_height anchr_ts required_auths required_posting_auths nonce status ops { type, index, data } rc_limit ledger { type from to amount asset memo params } ledger_actions { type status to amount asset memo data } output { id index } }}`;

	async function loadDetails() {
		error = '';
		try {
			const [hafRes, gqlRes] = await Promise.all([
				fetch(`https://techcoderx.com/hafah-api/transactions/${tx.id}?include-virtual=true`),
				fetch('https://vsc.techcoderx.com/api/v1/graphql', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						query: GRAPHQL_QUERY,
						variables: { opts: { byId: tx.id, offset: 0, limit: 1 } }
					})
				})
			]);

			if (!hafRes.ok || !gqlRes.ok) throw new Error('Fetch failed');

			const hafData = await hafRes.json();
			const gqlData = await gqlRes.json();
			const txns = gqlData.data?.txns;

			const opJson = hafData.transaction_json?.operations?.[0]?.value?.json;
			if (opJson) {
				const parsed = JSON.parse(opJson);
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

				if (payloadContent && parsed.action === 'map' && txns && txns.length > 0) {
					const ledgerActions = txns[0].ledger_actions;
					if (ledgerActions && ledgerActions.length > 0) {
						const depositAction = ledgerActions.find(
							(a: any) => a.type === 'deposit' && a.asset === 'sat'
						);
						if (depositAction) {
							payloadContent.amount = depositAction.amount;
						}
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
					if (instruction && instruction.startsWith('deposit_to=')) {
						let to = instruction.split('=')[1];
						if (to.startsWith('hive:')) {
							to = to.substring(5);
						}
						toAccount = to;
					} else {
						toAccount = 'Unknown';
					}
				}
			}

			const fetchedOutputId = txns?.[0]?.output?.[0]?.id;
			outputId = fetchedOutputId || '';
			statusValues = txns?.[0]?.status || '';
			if (fetchedOutputId) {
				const dagQuery = `query DagByCID($cid0: String!) { d0: getDagByCID(cidString: $cid0) }`;
				const dagRes = await fetch('https://vsc.techcoderx.com/api/v1/graphql', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						query: dagQuery,
						variables: { cid0: fetchedOutputId }
					})
				});
				if (dagRes.ok) {
					const dagData = await dagRes.json();
					const d0 = dagData.data?.d0;
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
		{:else}
			<div class="amount section">
				<h3>Amount</h3>
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
							err: {result.err},<br />
							{result.errMsg}
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
					<a href={'https://vsc.techcoderx.com/tx/' + tx.id} target="_blank" rel="noreferrer">
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

	.error {
		color: red;
	}

	.success {
		color: green;
	}

	.copyable-text {
		font-size: var(--text-sm);
		word-break: break-all;
	}
</style>
