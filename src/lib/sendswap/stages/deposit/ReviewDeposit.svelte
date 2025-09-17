<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getAccountNameFromDid, getDidFromUsername } from '$lib/getAccountName';
	import { Coin, Network, TransferMethod } from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import moment from 'moment';
	import ReviewSwap from '../ReviewSwap.svelte';

	let {
		status,
		waiting,
		abort
	}: {
		status: { message: string; isError: boolean };
		waiting: boolean;
		abort: () => void;
	} = $props();

	const toCoin = $derived($SendTxDetails.toCoin?.coin ?? coins.unk);
	let toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));
	let inUsd = $state('');
	$effect(() => {
		new CoinAmount($SendTxDetails.toAmount, toCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toMinFigs();
			});
	});
	let today = moment().format('MMM D, YYYY');
</script>

<div class="review-deposit">
	{#if $SendTxDetails.method?.value === TransferMethod.lightningTransfer.value}
		<ReviewSwap {status} {waiting} {abort} />
	{:else}
		<h2>Review</h2>
		<Card>
			<span class="dark sm-caption">Deposit</span>
			<div class="amount">
				<h4>
					{new CoinAmount($SendTxDetails.toAmount, toCoin).toPrettyString()}
					{`(${inUsd} US$)`}
				</h4>
			</div>
		</Card>
		<div class="recipient">
			<table>
				<tbody>
					<tr>
						<td class="sm-caption label">Address</td>
						<td class="content">
							<BasicCopy value={$SendTxDetails.toUsername}>{getAccountNameFromDid(toDid)}</BasicCopy
							>
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
					<tr>
						<td class="sm-caption label">Initiated on</td>
						<td class="content">{today}</td>
					</tr>
				</tbody>
			</table>
		</div>
		{#if status.message}
			<div class="status-wrapper">
				<span class="sm-caption">Status</span>
				<p class={{ status: !status.isError, error: status.isError }}>{status.message}</p>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.amount {
		padding: 1rem 0;
	}
	h4 {
		font-size: var(--text-6xl);
		// font-weight: 400;
		// color: var(--neutral-fg);
		margin: 0;
	}
	.dark {
		color: var(--neutral-fg);
	}
	table,
	tbody,
	tr {
		width: calc(100% - 1rem);
	}
	.recipient {
		width: calc(100% - 1rem);
		margin: 0 0.5rem;
		border-bottom: 1px solid var(--neutral-bg-accent);
		padding: 0.5rem 0;
	}
	.recipient {
		border-top: 1px solid var(--neutral-bg-accent);
		margin-top: 1rem;
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
