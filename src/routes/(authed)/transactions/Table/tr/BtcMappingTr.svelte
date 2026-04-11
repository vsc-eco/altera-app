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
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromDid } from '$lib/getAccountName';
	import StatusView from './StatusView.svelte';
	import { DagByCIDStore, FindContractOutputStore } from '$houdini';

	type Props = {
		tx: TransactionInter;
		op: TransactionOpType;
		onRowClick: (op: [string, number], content: () => ReturnType<Snippet>) => void;
	};
	let { tx, op, onRowClick }: Props = $props();

	let loading = $state(true);
	let outputId = $state('');
	let error = $state('');
	let statusValues = $state('');
	let result: { ok: boolean; ret?: string; errMsg?: string; err?: string } | null = $state(null);
	let fromAccount = $state('');
	let toAccount = $state('');

	const did = $derived(getAuth()().value!.did);

	const { anchr_height: block_height } = $derived(tx);

	const contractInfo = $derived.by(() => {
		let payload = op.data;
		if (typeof payload.json === 'string') {
			payload = JSON.parse(payload.json);
		}

		const action = payload.action;
		if (action === 'map') {
			return { action, displayType: 'deposit', direction: 'incoming' as const };
		} else if (action === 'unmap') {
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

	// Extract payload data from op.data.payload.Data (base64 encoded)
	const payloadData = $derived.by(() => {
		try {
			const payloadDataBase64 = op.data?.payload?.Data;
			if (!payloadDataBase64 || typeof payloadDataBase64 !== 'string') {
				return null;
			}
			let decoded = atob(payloadDataBase64);

			if (!decoded || decoded.trim() === '') {
				return null;
			}

			let parsed = JSON.parse(decoded);

			if (typeof parsed === 'string' && parsed.trim() !== '') {
				try {
					parsed = JSON.parse(parsed);
				} catch {
					return null;
				}
			}

			return parsed;
		} catch (e) {
			console.error('Failed to decode payload Data', e);
			return null;
		}
	});

	// Extract details from op.data directly
	const details = $derived.by(() => {
		const action = op.data?.action;
		const contract_id = op.data?.contract_id;
		const payload = payloadData;

		return {
			action,
			contract_id,
			payload: payload
				? {
						amount: payload.amount,
						// unmap/transfer/transferFrom use 'to'; legacy may still have 'recipient_btc_address'
						to: payload.to ?? payload.recipient_btc_address,
						// transferFrom includes 'from'
						from: payload.from,
						tx_data: payload.tx_data,
						instructions: payload.instructions
					}
				: undefined
		};
	});

	// Load outputId, statusValues, and result from GraphQL
	async function loadOutputData() {
		error = '';
		try {
			const fetchedOutputIds = tx?.output?.map((o) => o.id);

			// const outputStore = new FindContractOutputStore();
			const dagResultStore = new DagByCIDStore();
			if (fetchedOutputIds) {
				// Save for when errors are properly returned here
				// Promise.allSettled(
				// 	fetchedOutputIds.map((id) =>
				// 		outputStore.fetch({
				// 			variables: {
				// 				filterOptions: {
				// 					byId: id
				// 				}
				// 			},
				// 			policy: 'NetworkOnly'
				// 		})
				// 	)
				// ).then((queryResults) => {
				// 	let allResults: string[] = [];
				// 	queryResults.forEach((qRes) => {
				// 		if (qRes.status === 'fulfilled') {
				// 			const contractResults = qRes.value.data?.findContractOutput?.[0]?.results;
				// 			contractResults?.forEach((cRes) => {
				// 				if (cRes.ok) {
				// 					allResults.push(cRes.ret);
				// 				}
				// 			});
				// 		}
				// 	});
				// 	if (allResults.length === 0) {
				// 		result = ['Transaction failed'];
				// 	} else {
				// 		result = allResults;
				// 	}
				// });

				// NOTE: this makes queries for all of the possible outputs so we can combine the results.
				Promise.allSettled(
					fetchedOutputIds.map((id) =>
						dagResultStore.fetch({
							variables: { cid0: id },
							policy: 'NetworkOnly'
						})
					)
				).then((queryResults) => {
					queryResults.forEach((qRes) => {
						if (qRes.status === 'fulfilled') {
							const dagRes = qRes.value;
							if (dagRes.data) {
								const d0 = dagRes.data?.d0;
								// NOTE: for this parsing, lets make a type representing what we expect to get, and parse into that.
								// then we can more easily get errors, too, which seems not to be working
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
					});
				});
			}
		} catch (e) {
			error = 'Failed to load details';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	// Set fromAccount and toAccount based on action
	$effect(() => {
		const action = details.action;
		if (action === 'unmap') {
			fromAccount = did;
			toAccount = details.payload?.to ?? 'Unknown';
		} else if (action === 'transfer') {
			fromAccount = did;
			toAccount = details.payload?.to ?? 'Unknown';
		} else if (action === 'transferFrom') {
			fromAccount = details.payload?.from ?? did;
			toAccount = details.payload?.to ?? 'Unknown';
		} else if (action === 'map') {
			fromAccount = 'Bitcoin Network';
			// map = deposit: parse instructions for deposit_to
			const instruction = details.payload?.instructions?.[0];
			if (instruction) {
				try {
					const params = new URLSearchParams(instruction);
					const depositTo = params.get('deposit_to') ?? '';
					if (depositTo) {
						const username = depositTo.includes(':') ? depositTo.split(':')[1] : depositTo;
						toAccount = username || getUsernameFromDid(did);
					} else {
						toAccount = getUsernameFromDid(did);
					}
				} catch (e) {
					console.error('Failed to parse instruction params:', instruction, e);
					toAccount = getUsernameFromDid(did);
				}
			} else {
				toAccount = getUsernameFromDid(did);
			}
		}
	});

	loadOutputData();

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
		const lines = errMsg
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		for (const line of lines) {
			if (/^msg:/i.test(line)) return line.replace(/^msg:\s*/i, '').trim();
			if (/^err:/i.test(line)) return line.replace(/^err:\s*/i, '').trim();
		}
		const nonFile = lines.find((l) => !/^file:/i.test(l));
		return (nonFile || lines[0] || '')
			.replace(/^msg:\s*/i, '')
			.replace(/^err:\s*/i, '')
			.trim();
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
	<Type direction={contractInfo.direction} t={contractInfo.displayType} />
</tr>

{#snippet contractRowContent()}
	<span>
		{#if details?.action === 'map'}
			<h2>Deposit</h2>
		{:else if details?.action === 'unmap'}
			<h2>Withdrawal</h2>
		{:else if details?.action === 'transfer'}
			<h2>Transfer</h2>
		{:else if details?.action === 'transferFrom'}
			<h2>Transfer From</h2>
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
					<a href={'https://vsc.techcoderx.com/tx/' + tx.id} target="_blank" rel="noreferrer">
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

			{#if details?.payload?.to}
				<div class="section">
					<h3>Recipient Address</h3>
					<div class="copyable-text">
						<BasicCopy value={details.payload.to} />
					</div>
				</div>
			{/if}

			{#if details?.action === 'transferFrom' && details?.payload?.from}
				<div class="section">
					<h3>Source Account</h3>
					<div class="copyable-text">
						<BasicCopy value={details.payload.from} />
					</div>
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
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
		margin-top: 0.5rem;
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
