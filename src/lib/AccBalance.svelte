<script lang="ts">
	import { browser } from '$app/environment';
	import { getHiveAssetName, getHbdAssetName } from '../client';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from './sendswap/utils/sendOptions';
	import { accountBalanceHistory, sumBalance } from './stores/balanceHistory';
	import { accountBalance } from './stores/currentBalance';
	import moment from 'moment';
	import InfoToolip from './components/InfoTooltip.svelte';
	import { numberFormatLanguage } from '$lib/constants';

	type Props = {
		did: string;
	};
	let { did }: Props = $props();

	const hiveAssetName = $derived(browser ? getHiveAssetName() : 'HIVE');
	const hbdAssetName = $derived(browser ? getHbdAssetName() : 'HBD');
	function formatWithUnit(
		amt: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
		unit: string
	): string {
		const n = Math.abs(amt.amount) / 10 ** amt.coin.decimalPlaces;
		const formatter = new Intl.NumberFormat(numberFormatLanguage, {
			useGrouping: true,
			minimumFractionDigits: amt.coin.decimalPlaces
		});
		return `${amt.amount < 0 ? '-' : ''}${formatter.format(n)} ${unit}`;
	}

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
		<div class="title-right">
			<a href="" class="see-all">See all</a>
		</div>
	</div>

	<table>
		<tbody>
			<tr>
				<td><img src={Coin.hbd.icon} alt="" /></td>
				<td class="coin-cell">{hbdAssetName}</td>
				<td class="amount-cell"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true),
						hbdAssetName
					)}&nbsp;</td
				>
			</tr>
			<tr>
				<th> </th><td class="icon-cell"><img src={Coin.hbd.icon} alt="" /></td>
				<td class="coin-cell">
					<span class="coin-name">Liquid {hbdAssetName} Savings (s{hbdAssetName})</span>
					<span class="tooltip">
						<InfoToolip
							>s{hbdAssetName} is {hbdAssetName} that remains transferable while earning 15% APR</InfoToolip
						>
					</span>
				</td>
				<td class="amount-cell"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hbd_savings, Coin.hbd, true),
						hbdAssetName
					)}&nbsp;</td
				>
			</tr>
			{#if $accountBalance.bal.pending_hbd_unstaking && $accountBalance.bal.pending_hbd_unstaking !== 0}
				<tr>
					<th> </th><td><img src={Coin.hbd.icon} alt="" /></td>
					<td class="coin-cell">{hbdAssetName} Unstaking</td>
					<td class="amount-cell"
						>{formatWithUnit(
							new CoinAmount($accountBalance.bal.pending_hbd_unstaking, Coin.hbd, true),
							hbdAssetName
						)}&nbsp;</td
					>
				</tr>
			{/if}
			<tr>
				<td><img src={Coin.hive.icon} alt="" /></td>
				<td class="coin-cell">{hiveAssetName}</td>
				<td class="amount-cell"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hive, Coin.hive, true),
						hiveAssetName
					)}</td
				>
			</tr>
			<tr>
				<td class="image-cell"><img src={Coin.hive.icon} alt="" /></td>
				<td class="coin-cell">{hiveAssetName} Consensus</td>
				<td class="amount-cell"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hive_consensus, Coin.hive, true),
						hiveAssetName
					)}</td
				>
			</tr>
			{#if $accountBalance.bal.consensus_unstaking !== 0}
				<tr>
					<th> </th><td><img src={Coin.hive.icon} alt="" /></td>
					<td class="coin-cell">{hiveAssetName} Unstaking</td>
					<td class="amount-cell"
						>{formatWithUnit(
							new CoinAmount($accountBalance.bal.consensus_unstaking, Coin.hive, true),
							hiveAssetName
						)}</td
					>
				</tr>
			{/if}
			<tr>
				<td><img src={Coin.btc.icon} alt="Bitcoin" /></td>
				<td class="coin-cell">Bitcoin (SATS)</td>
				<td class="amount-cell"
					>{new CoinAmount($accountBalance.bal.btc, Coin.btc, true).toPrettyString()}</td
				>
			</tr>
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
		margin-bottom: 0.25rem;
	}
	.title-and-tooltip h5 {
		color: var(--dash-text-primary);
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
	}
	.title-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.see-all {
		color: var(--dash-accent-purple);
		font-size: 0.8rem;
		text-decoration: none;
		font-weight: 500;
	}
	.see-all:hover {
		text-decoration: underline;
	}
	img {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
	}
	td {
		width: fit-content;
		white-space: nowrap;
		vertical-align: middle;
	}
	.icon-cell {
		flex-shrink: 0;
	}
	table {
		width: 100%;
	}
	tr {
		container-type: inline-size;
		container-name: table-row;
		display: flex;
		padding: 0.75rem 0.375rem;
		border-bottom: 1px solid var(--dash-divider);
		min-width: 200px;
		align-items: center;
	}
	.coin-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: flex-start;
		flex-wrap: wrap;
		padding-left: 0.625rem;
		font-weight: 500;
		min-width: 100px;
		flex: 1 1 auto;
		color: var(--dash-text-primary);
		font-size: 0.9rem;
		.coin-title-row {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
		}
		.coin-title {
			font-weight: 600;
			line-height: 1.25;
		}
		.coin-name {
			font-size: 0.85rem;
		}
		.coin-subtle {
			font-size: var(--text-xs);
			color: var(--dash-text-muted);
			font-weight: 400;
			line-height: 1.2;
			margin-top: 0.125rem;
		}
		.tooltip {
			display: inline-flex;
			vertical-align: middle;
		}
	}
	.amount-cell {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
		margin-left: auto;
		align-self: center;
		text-align: right;
		flex-shrink: 0;
		color: var(--dash-text-primary);
		font-size: 0.85rem;
	}
	tr:last-child {
		border-bottom: none;
	}
</style>
