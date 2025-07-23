<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { Coin, Network, SendAccount } from '$lib/send/sendOptions';
	import moment from 'moment';
	import { SendTxDetails } from '$lib/send/sendUtils';

	let auth = $authStore;
	let {
		id,
		editStage,
		status
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
		status: string;
	} = $props();

	$effect(() => {
		editStage(id, true);
	})

	let fromCoin = $derived($SendTxDetails.fromCoin?.coin ?? coins.unk);
	let inUsd = $state('');
	$effect(() => {
		new CoinAmount($SendTxDetails.fromAmount, fromCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toAmountString();
			});
	});
	let today = moment().format('MMM D, YYYY');
	let fromAccount = $derived.by(() => {
		if ($SendTxDetails.account?.value === SendAccount.vscAccount.value) {
			return $SendTxDetails.account.label;
		}
		if ($SendTxDetails.account?.value === SendAccount.deposit.value) {
			return `Deposit from ${$SendTxDetails.fromNetwork?.label ?? 'UNK'}`;
		}
		if ($SendTxDetails.account?.value === SendAccount.swap.value) {
			return `Swap from ${$SendTxDetails.fromNetwork?.label ?? 'UNK'}`;
		}
	});
</script>

<h2>Review</h2>

<Card>
	<div class="amount">
		<span class="sm-caption">Payment to {$SendTxDetails.toDisplayName}</span>
		<h4>{new CoinAmount($SendTxDetails.fromAmount, fromCoin).toPrettyString()} {`(\$US ${inUsd})`}</h4>
	</div>
	<div class="date">
		<span>Pay once on {today}</span>
	</div>
</Card>
<div class="recipient">
	<table>
		<tbody>
			<tr>
				<td class="label">Recipient</td>
				<td class="content">{$SendTxDetails.toDisplayName}</td>
			</tr>
			<tr>
				<td class="label">Address</td>
				<td class="content">{$SendTxDetails.toUsername}</td>
			</tr>
			<tr>
				<td class="label">Asset</td>
				<td class="content coin">
					<img src={fromCoin.icon} alt={fromCoin.label} />
					{fromCoin.label}
				</td>
			</tr>
			<tr>
				<td class="label">Network</td>
				<td class="content">{$SendTxDetails.toNetwork?.label}</td>
			</tr>
		</tbody>
	</table>
</div>
<div class="sender">
	<table>
		<tbody>
			<tr>
				<td class="label">From</td>
				<td class="content">{getUsernameFromAuth(auth)}</td>
			</tr>
			<tr>
				<td class="label">Account</td>
				<td class="content">{fromAccount}</td>
			</tr>
			<tr>
				<td class="label">Initiated on</td>
				<td class="content">{today}</td>
			</tr>
		</tbody>
	</table>
</div>
{#if status}
	<div class="status-wrapper">
		<span class="sm-caption">Status</span>
		<span class="status">{status}</span>
	</div>
{/if}

<style lang="scss">
	h4 {
		padding: 1.5rem 0;
		font-size: var(--text-6xl);
		// font-weight: 400;
		// color: var(--neutral-fg);
		margin: 0;
	}
	.date {
		padding: 1.5rem 0 1rem;
		border-top: 1px solid var(--neutral-bg-accent);
	}
	.sm-caption,
	.label {
		font-size: var(--text-sm);
	}
	.label {
		color: var(--neutral-mid);
	}
	table,
	tbody,
	tr {
		width: calc(100% - 1rem);
	}
	.recipient,
	.sender {
		width: calc(100% - 1rem);
		margin: 0 0.5rem;
		padding: 1rem 0;
		border-bottom: 1px solid var(--neutral-bg-accent);
	}
	.recipient {
		margin-top: 2rem;
		border-top: 1px solid var(--neutral-bg-accent);
	}
	tr {
		display: flex;
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
		flex: 0 1 12rem;
	}
	.status-wrapper {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
</style>
