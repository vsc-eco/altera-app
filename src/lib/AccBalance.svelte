<script lang="ts">
	import { GetAccountBalanceStore } from '$houdini';
	import { untrack } from 'svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from './send/sendOptions';
	import { accountBalanceHistory, sumBalance } from './stores/balanceHistory';
	import { accountBalance, type AccountBalance } from './stores/currentBalance';
	import moment from 'moment';
	import InfoToolip from './components/InfoToolip.svelte';

	type Props = {
		did: string;
	};
	let { did }: Props = $props();

	$effect(() => {
		(async () => {
			const total = await sumBalance($accountBalance.bal);
			const lastEntry = $accountBalanceHistory.at(-1);
			if (lastEntry && (moment(lastEntry.date).minutes() === 0 || lastEntry.value !== total)) {
				accountBalanceHistory.update((arr) => {
					if (moment(lastEntry.date).minutes() === 0) {
						arr.push({
							date: moment().toDate(),
							value: total
						});
					} else {
						arr[arr.length - 1] = {
							date: moment().toDate(),
							value: total
						};
					}
					return arr;
				});
			}
		})();
	});
</script>

<div class="box">
	<div class="title-and-tooltip">
		<h5>Balances</h5>
		<InfoToolip>Only balance deposited in VSC is listed.</InfoToolip>
	</div>

	<table>
		<tbody>
			<tr>
				<td><img src={Coin.hbd.icon} alt="" /></td>
				<td class="coin-cell">HBD</td>
				<td class="amount-cell"
					>{new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true).toPrettyString()}&nbsp;</td
				>
			</tr>
			<tr>
				<th> </th><td><img src={Coin.hbd.icon} alt="" /></td>
				<td class="coin-cell">
					<span class="coin-name">Liquid Hive Dollar Savings (sHBD)</span>
					<span class="tooltip">
						<InfoToolip>
							sHBD is HBD that remains transferable while earning 15% APR
						</InfoToolip>
					</span>
				</td>
				<td class="amount-cell"
					>{new CoinAmount(
						$accountBalance.bal.hbd_savings,
						Coin.hbd,
						true
					).toPrettyString()}&nbsp;</td
				>
			</tr>
			{#if $accountBalance.bal.pending_hbd_unstaking && $accountBalance.bal.pending_hbd_unstaking !== 0}
				<tr>
					<th> </th><td><img src={Coin.hbd.icon} alt="" /></td>
					<td class="coin-cell">HBD Unstaking</td>
					<td class="amount-cell"
						>{new CoinAmount(
							$accountBalance.bal.pending_hbd_unstaking,
							Coin.hbd,
							true
						).toPrettyString()}&nbsp;</td
					>
				</tr>
			{/if}
			<tr>
				<td><img src={Coin.hive.icon} alt="" /></td>
				<td class="coin-cell">Hive</td>
				<td class="amount-cell"
					>{new CoinAmount($accountBalance.bal.hive, Coin.hive, true).toPrettyString()}</td
				>
			</tr>
			<tr>
				<td class="image-cell"><img src={Coin.hive.icon} alt="" /></td>
				<td class="coin-cell">Hive Consensus</td>
				<td class="amount-cell"
					>{new CoinAmount(
						$accountBalance.bal.hive_consensus,
						Coin.hive,
						true
					).toPrettyString()}</td
				>
			</tr>
			{#if $accountBalance.bal.consensus_unstaking !== 0}
				<tr>
					<th> </th><td><img src={Coin.hive.icon} alt="" /></td>
					<td class="coin-cell">Hive Unstaking</td>
					<td class="amount-cell"
						>{new CoinAmount(
							$accountBalance.bal.consensus_unstaking,
							Coin.hive,
							true
						).toPrettyString()}</td
					>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

<style lang="scss">
	.box {
		margin: 0.75rem;
		margin-top: 0;
	}
	.title-and-tooltip {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
	}
	img {
		width: 1.25rem;
		height: 1.25rem;
	}
	td {
		width: fit-content;
		white-space: nowrap;
		vertical-align: middle;
	}
	table {
		width: 100%;
	}
	tr {
		container-type: inline-size;
		container-name: table-row;
		display: flex;
		padding: 1rem 0.5rem;
		border-bottom: 1px solid var(--neutral-bg-mid);
		min-width: 200px;
		align-items: center;
	}
	.coin-cell {
		display: flex;
		padding-left: 0.5rem;
		align-items: center;
		font-weight: 500;
		.coin-name {
			display: flex;
			flex: 0 1 auto;
			text-align: left;
			overflow-wrap: break-word;
			white-space: normal;
		}
		min-width: 120px;
		.tooltip {
			padding: 0 0.25rem;
			flex-grow: 1;
		}
	}
	.amount-cell {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
		margin-left: auto;
		align-self: right;
		text-align: right;
	}
	tr:last-child {
		border-bottom: none;
	}
</style>
