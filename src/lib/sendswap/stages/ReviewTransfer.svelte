<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
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
	let inUsd = $state('');
	let isInstructions = $derived(
		auth.value?.provider === 'reown' &&
			txState.from?.network.value === Network.hiveMainnet.value
	);
	$effect(() => {
		new CoinAmount(txState.toAmount, toCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toMinFigs();
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
				{`(${inUsd} US$)`}
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
