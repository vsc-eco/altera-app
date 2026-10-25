<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount, formatUsd } from '$lib/currency/CoinAmount';
	import {
		getAccountNameFromAuth,
		getAccountNameFromDid,
		getDidFromUsername
	} from '$lib/getAccountName';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import moment from 'moment';
	import { useTransferState } from '$lib/sendswap/utils/txState.svelte';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import Instructions from '../components/Instructions.svelte';
	import TxStatus from '../components/shared/TxStatus.svelte';

	const txState = useTransferState();

	let auth = $derived(getAuth()());
	let {
		editStage,
		isActive,
		status,
		waiting = false,
		abort,
		compact
	}: {
		editStage: (complete: boolean) => void;
		isActive?: boolean;
		status: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
		compact?: boolean;
	} = $props();

	$effect(() => {
		if (isActive) {
			editStage(true);
		}
	});

	let toCoin = $derived(txState.to?.coin ?? Coin.unk);
	let inUsd = $state(0);
	let isInstructions = $derived(
		auth.value?.provider === 'reown' &&
			txState.from?.network.value === Network.hiveMainnet.value
	);
	$effect(() => {
		new CoinAmount(txState.toAmount, toCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toNumber();
			});
	});
	let today = moment().format('MMM D, YYYY');
	let fromNetwork = $derived.by(() => {
		const net = txState.from?.network;
		if (net?.value === Network.hiveMainnet.value) {
			return `Deposit from ${net.label}`;
		}
		if (net?.value === Network.lightning.value) {
			return `Swap from ${net.label}`;
		}
		return net?.label ?? 'UNK';
	});
	let toDid = $derived(getDidFromUsername(txState.toUsername));

	// Internal (Magi→Magi) transfers of chain-backed assets stay on Magi: the
	// recipient gets Magi-side funds, NOT a payout to a Bitcoin address or their
	// Hive account. Warn loudly before signing — picking "Internal Transfer" for
	// what should have been a withdrawal (as happened on mainnet) leaves the
	// funds stuck until the recipient logs into Altera to move them.
	const CHAIN_BACKED = new Set(['btc', 'sats', 'hive', 'hbd']);
	let isInternalMagi = $derived(
		txState.from?.network.value === Network.magi.value &&
			txState.to?.network.value === Network.magi.value
	);
	let showInternalWarning = $derived(isInternalMagi && CHAIN_BACKED.has(toCoin.value));
	let externalWhere = $derived(
		toCoin.value === 'btc' || toCoin.value === 'sats' ? 'a Bitcoin address' : 'their Hive wallet'
	);

	// $inspect(waiting);
</script>

<h2>Review</h2>

{#if isInstructions}
	<Instructions />
{:else}
	<Card>
		<span class="dark sm-caption">Payment to {txState.toDisplayName}</span>
		<div class={['amount', { compact }]}>
			<h4>
				{new CoinAmount(txState.toAmount, toCoin).toPrettyString()}
				{`(${formatUsd(inUsd)})`}
			</h4>
		</div>
		{#if !compact}
			<div class="date">
				<span>Pay once on {today}</span>
			</div>
		{/if}
	</Card>
	<div class={['recipient', { compact }]}>
		<table>
			<tbody>
				{#if txState.toDisplayName !== txState.toUsername}
					<tr>
						<td class="sm-caption label">Recipient</td>
						<td class="content">{txState.toDisplayName}</td>
					</tr>
				{/if}
				<tr>
					<td class="sm-caption label">Address</td>
					<td class="content">
						<BasicCopy value={txState.toUsername}>{getAccountNameFromDid(toDid)}</BasicCopy>
					</td>
				</tr>
				<tr>
					<td class="sm-caption label">Asset</td>
					<td class="content coin">
						<img src={toCoin.icon} alt={toCoin.label} />
						{toCoin.label}
					</td>
				</tr>
				<tr>
					<td class="sm-caption label">Network</td>
					<td class="content">{txState.to?.network.label}</td>
				</tr>
			</tbody>
		</table>
	</div>
	<div class={['sender', { compact }]}>
		<table>
			<tbody>
				<tr>
					<td class="sm-caption label">From</td>
					<td class="content">{getAccountNameFromAuth(auth)}</td>
				</tr>
				<tr>
					<td class="sm-caption label">Network</td>
					<td class="content">{fromNetwork}</td>
				</tr>
				<tr>
					<td class="sm-caption label">Initiated on</td>
					<td class="content">{today}</td>
				</tr>
			</tbody>
		</table>
	</div>
	{#if txState.memo}
		<div class={['memo', { compact }]}>
			<table>
				<tbody>
					<tr>
						<td class="sm-caption label">Memo</td>
						<td class="content">{txState.memo}</td>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
	{#if showInternalWarning}
		<div class={['internal-warning', { compact }]} role="alert">
			<strong>Internal transfer — these funds stay on Magi.</strong>
			You're sending {toCoin.label} to {txState.toDisplayName} inside Magi. It will
			<strong>not</strong> be sent to {externalWhere} — {txState.toDisplayName} can only
			access it by logging into Altera (or another Magi wallet). Make sure you meant an
			internal transfer; it may not be recoverable otherwise.
		</div>
	{/if}
	<TxStatus
		{status}
		{waiting}
		abort={() => (abort ? abort() : undefined)}
		showHiveWarning={auth.value?.provider === 'aioha'}
	/>
{/if}

<style lang="scss">
	.amount {
		padding: 1.5rem 0;
		p {
			color: var(--dash-text-secondary);
		}
		&.compact {
			padding: 1rem 0;
		}
	}
	h4 {
		font-size: var(--text-6xl);
		// font-weight: 400;
		// color: var(--neutral-fg);
		margin: 0;
	}
	.date {
		padding: 1.5rem 0 1rem;
		border-top: 1px solid var(--dash-card-border);
	}
	.dark {
		color: var(--dash-text-primary);
	}
	.internal-warning {
		width: calc(100% - 1rem);
		box-sizing: border-box;
		margin: 1.5rem 0.5rem 0;
		padding: 0.85rem 1rem;
		border: 1px solid var(--dash-accent-red, #ef4444);
		background: var(--dash-badge-red-bg, rgba(239, 68, 68, 0.15));
		color: var(--dash-badge-red-text, #ef4444);
		border-radius: 12px;
		font-size: var(--text-sm);
		line-height: 1.4;
		strong {
			font-weight: 700;
		}
		&.compact {
			margin-top: 1rem;
		}
	}
	table,
	tbody,
	tr {
		width: calc(100% - 1rem);
	}
	.recipient,
	.sender,
	.memo {
		width: calc(100% - 1rem);
		margin: 0 0.5rem;
		padding: 1rem 0;
		border-bottom: 1px solid var(--dash-card-border);
		&.compact {
			padding: 0.5rem 0;
		}
	}
	.recipient {
		margin-top: 2rem;
		border-top: 1px solid var(--dash-card-border);
		&.compact {
			margin-top: 1rem;
		}
	}
	tr {
		display: flex;
		padding: 0 0.5rem;
	}
	td {
		height: 2.5rem;
		display: flex;
		align-items: center;
	}
	.coin {
		gap: 0.5rem;
		img {
			width: 16px;
		}
	}
	.label {
		width: min(12rem, 40%);
	}
	.content {
		line-height: 1.2;
		flex-basis: 0;
		flex-grow: 1;
	}
	@media screen and (max-width: 450px) {
		table,
		tbody,
		tr {
			width: 100%;
		}
		tr {
			padding: 0;
		}
	}
</style>
