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
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import Amount from '../tds/Amount.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import Token from '../tds/Token.svelte';
	import ContractId from '../tds/ContractId.svelte';

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

	let loading = $state(false);
	let details = $state<Details | null>(null);
	let outputId = $state('');
	let error = $state('');
	let statusValues = $state('');
	let result = $state<any>(null);

	const GRAPHQL_QUERY = `query AccHistory ($opts: TransactionFilter) { txns: findTransaction(filterOptions: $opts) { id anchr_height anchr_ts required_auths required_posting_auths nonce status ops { type, index, data } rc_limit ledger { type from to amount asset memo params } ledger_actions { type status to amount asset memo data } output { id index } }}`;

	async function handleTrigger() {
		loading = true;
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

			// Parse HAF API response
			const opJson = hafData.transaction_json?.operations?.[0]?.value?.json;
			if (opJson) {
				const parsed = JSON.parse(opJson);
				details = {
					net_id: parsed.net_id,
					contract_id: parsed.contract_id,
					action: parsed.action,
					payload: parsed.payload,
					rc_limit: parsed.rc_limit,
					intents: parsed.intents
				};
			}

			// Parse GraphQL response
			const fetchedOutputId = gqlData.data?.txns?.[0]?.output?.[0]?.id;
			outputId = fetchedOutputId || '';
			statusValues = gqlData.data?.txns?.[0]?.status || '';
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

		onRowClick([tx.id, op.index], contractRowContent);
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTrigger();
			e.preventDefault();
		}
	}

	const amt: string = $derived.by(() => {
		const intents = op.data.intents;
		if (!intents) return '0';
		return intents[0]?.args?.limit ?? '0';
	});
	const coinVal: string = $derived.by(() => {
		const intents = op.data.intents;
		if (!intents) return coins.hive.value;
		return intents[0]?.args?.limit ?? coins.hive.value;
	});
	const amount = $derived(
		new CoinAmount(amt, Coin[coinVal.split('_')[0] as keyof typeof Coin] || Coin.hive, true)
	);
	let inUsd = $state('');
	$effect(() => {
		amount.convertTo(Coin.usd, Network.lightning).then((amount) => {
			inUsd = amount.toAmountString();
		});
	});

	// Derived display amount prioritizing API payload
	const displayAmount = $derived.by(() => {
		if (details?.payload?.amount) {
			return new CoinAmount(details.payload.amount.toString(), Coin.hive, true);
		}
		return amount;
	});
</script>

<tr
	data-tx-id={tx.id}
	tabindex="0"
	onclick={handleTrigger}
	onkeydown={handleKeydown}
	class="clickable-row"
>
	<td class="date">{moment(getTimestamp(tx)).format('MMM DD')}</td>
	<ContractId address={op.data.contract_id ?? ''} status={tx.status} />
	<Amount {amount} direction={'contract'} />
	<Token {amount} direction={'contract'} />

	<Type direction="contract" t={op.type!} />
</tr>

{#snippet contractRowContent()}
	<h2>
		{(op.type ?? tx.type)
			.replace('_', ' ')
			.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase())}
	</h2>
	<div class="sections">
		{#if loading}
			<p>Loading details...</p>
		{:else if error}
			<p class="error">{error}</p>
		{:else}
			<div class="amount section">
				<h3>Amount</h3>
				{details?.payload?.amount} BTC
				<!-- <span class="approx-usd">
					Approx. ${inUsd} USD
				</span> -->
			</div>

			{#if details?.action}
				<div class="section">
					<h3>Status</h3>
					<span>{statusValues === 'INCLUDED' ? 'PENDING' : statusValues}</span>
				</div>
			{/if}

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

			{#if details?.contract_id}
				<div class="section">
					<h3>Contract ID</h3>
					<div class="copyable-text">
						<BasicCopy value={details.contract_id} />
					</div>
				</div>
			{/if}

			{#if outputId}
				<div class="section">
					<h3>Output ID</h3>
					<div class="copyable-text">
						<BasicCopy value={outputId} />
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

			<div class="tx-id section">
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

	.tx-id.section {
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
