<script lang="ts">
	import type { BtcDepositEvent } from '$lib/indexer/btcMappingQueries';
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
	import StatusView from './StatusView.svelte';
	import { BTC_MAPPING_CONTRACT_ID, getVscExplorerTxUrl } from '$lib/constants';

	type Props = {
		event: BtcDepositEvent;
		onRowClick: (op: [string, number], content: () => ReturnType<Snippet>) => void;
	};
	let { event, onRowClick }: Props = $props();

	const anchorTs = $derived(
		event.indexer_ts.endsWith('Z') ? event.indexer_ts : event.indexer_ts + 'Z'
	);

	const displayAmount = $derived(
		new CoinAmount(satsToBtc(Number(event.amount)).toString(), Coin.btc, true)
	);

	let inUsd = $state('');
	$effect(() => {
		displayAmount.convertTo(Coin.usd, Network.lightning).then((amount) => {
			inUsd = amount.toAmountString();
		});
	});

	function handleTrigger() {
		onRowClick([event.indexer_tx_hash, 0], depositRowContent);
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleTrigger();
		}
	}
</script>

{#snippet depositRowContent()}
	<span><h2>Deposit</h2></span>
	<div class="sections">
		<div class="amount section">
			{satsToBtc(Number(event.amount))} BTC
			<span class="approx-usd"> Approx. ${inUsd} USD </span>
		</div>
		<StatusView
			anchor_ts={anchorTs}
			from={event.sender}
			to={event.recipient}
			status="CONFIRMED"
			block_height={event.indexer_block_height ?? 0}
			memo=""
		/>
		<div class="section">
			<h3>Sender Address</h3>
			<div class="copyable-text">
				<BasicCopy value={event.sender} />
			</div>
		</div>
		<div class="contract-id section">
			<h3>Contract ID</h3>
			<div class="copyable-text">
				<BasicCopy value={BTC_MAPPING_CONTRACT_ID} />
			</div>
		</div>
		<div class="section">
			<h3>Transaction Id</h3>
			<div class="copyable-text">
				<BasicCopy value={event.indexer_tx_hash} />
			</div>
		</div>
		<div class="links section">
			<h3>External Links</h3>
			<div class="links">
				<a href={getVscExplorerTxUrl(event.indexer_tx_hash)} target="_blank" rel="noreferrer">
					VSC Block Explorer<ExternalLink />
				</a>
				</div>
		</div>
	</div>
{/snippet}

<tr
	data-tx-id={event.indexer_tx_hash}
	tabindex="0"
	onclick={handleTrigger}
	onkeydown={handleKeydown}
	class="clickable-row"
>
	<td class="date">{moment(anchorTs).format('MMM DD')}</td>
	<ToFrom otherAccount={event.sender} />
	<Status status="CONFIRMED" />
	<Amount amount={displayAmount} direction="incoming" />
	<Type direction="incoming" t="deposit" />
</tr>

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
	.copyable-text {
		font-size: var(--text-sm);
		word-break: break-all;
	}
</style>
