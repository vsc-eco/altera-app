<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import {
		getAccountNameFromAuth,
		getAccountNameFromDid,
		getDidFromUsername
	} from '$lib/getAccountName';
	import { Coin, Network, SendAccount } from '$lib/send/sendOptions';
	import moment from 'moment';
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { ArrowDown, ArrowLeft, X } from '@lucide/svelte';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import Instructions from '$lib/send/stages/review/Instructions.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Confirmation from '$lib/components/Confirmation.svelte';

	let auth = $authStore;
	let {
		status,
		waiting,
		abort,
		compact
	}: {
		status: { message: string; isError: boolean };
		waiting: boolean;
		abort: () => void;
		compact?: boolean;
	} = $props();

	let toCoin = $derived($SendTxDetails.toCoin?.coin ?? coins.unk);
	let fromCoin = $derived($SendTxDetails.fromCoin?.coin ?? coins.unk);
	let inUsd = $state('');
	let isInstructions = $derived(
		auth.value?.provider === 'reown' &&
			$SendTxDetails.fromNetwork?.value === Network.hiveMainnet.value
	);
	$effect(() => {
		new CoinAmount($SendTxDetails.toAmount, toCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toAmountString();
			});
	});
	let isSwap = $derived($SendTxDetails.account?.value === SendAccount.swap.value);
	let today = moment().format('MMM D, YYYY');
	// let fromAccount = $derived.by(() => {
	// 	if ($SendTxDetails.account?.value === SendAccount.vscAccount.value) {
	// 		return $SendTxDetails.account.label;
	// 	}
	// 	if ($SendTxDetails.account?.value === SendAccount.deposit.value) {
	// 		return `Deposit from ${$SendTxDetails.fromNetwork?.label ?? 'UNK'}`;
	// 	}
	// 	if (isSwap) {
	// 		return `Swap from ${$SendTxDetails.fromNetwork?.label ?? 'UNK'}`;
	// 	}
	// });
	let fromNetwork = $derived.by(() => {
		if ($SendTxDetails.fromNetwork?.value === Network.hiveMainnet.value) {
			return `Deposit from ${$SendTxDetails.fromNetwork.label}`;
		}
		if ($SendTxDetails.fromNetwork?.value === Network.lightning.value) {
			return `Swap from ${$SendTxDetails.fromNetwork.label}`;
		}
		return $SendTxDetails.fromNetwork?.label ?? 'UNK';
	});
	let toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));

	// $inspect(waiting);
</script>

<h2>Review</h2>

{#if isInstructions}
	<Instructions />
{:else}
	<Card>
		<span class="dark sm-caption">Payment to {$SendTxDetails.toDisplayName}</span>
		<div class={['amount', { compact }]}>
			{#if isSwap}
				<div class="swap-header">
					<p>{new CoinAmount($SendTxDetails.fromAmount, fromCoin).toPrettyString()}</p>
					<ArrowDown />
				</div>
			{/if}
			<h4>
				{new CoinAmount($SendTxDetails.toAmount, toCoin).toPrettyString()}
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
				{#if $SendTxDetails.toDisplayName !== $SendTxDetails.toUsername}
					<tr>
						<td class="sm-caption label">Recipient</td>
						<td class="content">{$SendTxDetails.toDisplayName}</td>
					</tr>
				{/if}
				<tr>
					<td class="sm-caption label">Address</td>
					<td class="content">
						<BasicCopy value={$SendTxDetails.toUsername}>{getAccountNameFromDid(toDid)}</BasicCopy>
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
					<td class="content">{$SendTxDetails.toNetwork?.label}</td>
				</tr>
			</tbody>
		</table>
	</div>
	<div class={['sender', { compact }]}>
		<table>
			<tbody>
				{#if !isSwap}
					<tr>
						<td class="sm-caption label">From</td>
						<td class="content">{getAccountNameFromAuth(auth)}</td>
					</tr>
				{/if}
				<tr>
					<td class="sm-caption label">Network</td>
					<td class="content">{fromNetwork}</td>
				</tr>
				{#if isSwap && $SendTxDetails.fee}
					<tr>
						<td class="sm-caption label">Asset</td>
						<td class="content coin">
							<img src={fromCoin.icon} alt={fromCoin.label} />
							{fromCoin.label}
						</td>
					</tr>
					<tr>
						<td class="sm-caption label">Fee</td>
						<td class="content">
							{$SendTxDetails.fee}
						</td>
					</tr>
					<tr>
						<td class="sm-caption label">Total</td>
						<td class="content">
							{$SendTxDetails.fee?.add(new CoinAmount($SendTxDetails.fromAmount, fromCoin))}
						</td>
					</tr>
				{/if}
				<tr>
					<td class="sm-caption label">Initiated on</td>
					<td class="content">{today}</td>
				</tr>
			</tbody>
		</table>
	</div>
	{#if $SendTxDetails.memo}
		<div class={['memo', { compact }]}>
			<table>
				<tbody>
					<tr>
						<td class="sm-caption label">Memo</td>
						<td class="content">{$SendTxDetails.memo}</td>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
	{#if status.message}
		<div class="status-wrapper">
			<span class="sm-caption">Status</span>
			<p class={{ status: !status.isError, error: status.isError }}>{status.message}</p>
		</div>
	{/if}
{/if}
{#if waiting}
	<div class="waiting-overlay">
		<div class="waiting-card">
			<WaveLoading size={32} />
			<div class="info">
				<p>Waiting for signature</p>
				<span>
					<PillButton onclick={() => abort()} theme="secondary" styleType="invert">
						<X /> Cancel
					</PillButton>
				</span>
				{#if auth.value?.provider === 'aioha'}
					<p class="warning">
						<b class="error">Warning:</b> Transaction may still occur if it is authorized later via your
						hive wallet.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.amount {
		padding: 1.5rem 0;
		p {
			color: var(--primary-fg-mid);
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
		border-top: 1px solid var(--neutral-bg-accent);
	}
	.dark {
		color: var(--neutral-fg);
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
		border-bottom: 1px solid var(--neutral-bg-accent);
		&.compact {
			padding: 0.5rem 0;
		}
	}
	.recipient {
		margin-top: 2rem;
		border-top: 1px solid var(--neutral-bg-accent);
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
	.status-wrapper {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.waiting-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		background-color: rgba(58, 46, 57, 0.2);
		backdrop-filter: blur(4px);
		pointer-events: none;
		z-index: 1;
		.waiting-card {
			margin-top: 25%;
			font-weight: 500;
			padding: 1rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			pointer-events: all;
			background-color: var(--neutral-bg);
			border: 1px solid var(--neutral-bg-accent);
			border-radius: 0.5rem;
			height: min-content;
			.info {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				.warning {
					max-width: 20rem;
					text-align: center;
				}
			}
		}
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
