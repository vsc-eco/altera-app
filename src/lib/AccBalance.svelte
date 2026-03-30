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
	function formatWithUnit(amt: CoinAmount<typeof Coin.hive | typeof Coin.hbd>, unit: string, mockVal?: string): string {
		const n = Math.abs(amt.amount) / 10 ** amt.coin.decimalPlaces;
		if (n === 0 && mockVal) return mockVal;
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
						arr.push({ date: moment().toDate(), value: total });
					} else {
						arr[arr.length - 1] = { date: moment().toDate(), value: total };
					}
					return arr;
				});
			}
		})();
	});
</script>

<div class="balances-list">
	<div class="balances-header">
		<span class="balances-title">Balances</span>
		<a href="/" class="see-all">See all</a>
	</div>

	<div class="balance-row">
		<div class="row-icon hbd"><img src={Coin.hbd.icon} alt="" /></div>
		<div class="row-info">
			<span class="coin-name">{hbdAssetName}</span>
			<span class="coin-sub">Hive Backed Dollar</span>
		</div>
		<span class="row-amount">{formatWithUnit(new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true), hbdAssetName, '1,250.00 HBD')}</span>
	</div>

	<div class="balance-row">
		<div class="row-icon shbd"><img src={Coin.hbd.icon} alt="" /></div>
		<div class="row-info">
			<span class="coin-name">
				s{hbdAssetName}
				<span class="tooltip-inline"><InfoToolip>s{hbdAssetName} is {hbdAssetName} that remains transferable while earning 15% APR</InfoToolip></span>
			</span>
			<span class="coin-sub">Liquid Hive Dollar Savings</span>
		</div>
		<span class="row-amount">{formatWithUnit(new CoinAmount($accountBalance.bal.hbd_savings, Coin.hbd, true), hbdAssetName, '5,750.00 HBD')}</span>
	</div>

	{#if $accountBalance.bal.pending_hbd_unstaking && $accountBalance.bal.pending_hbd_unstaking !== 0}
		<div class="balance-row">
			<div class="row-icon hbd"><img src={Coin.hbd.icon} alt="" /></div>
			<div class="row-info">
				<span class="coin-name">{hbdAssetName} Unstaking</span>
			</div>
			<span class="row-amount">{formatWithUnit(new CoinAmount($accountBalance.bal.pending_hbd_unstaking, Coin.hbd, true), hbdAssetName)}</span>
		</div>
	{/if}

	<div class="balance-row">
		<div class="row-icon hive"><img src={Coin.hive.icon} alt="" /></div>
		<div class="row-info">
			<span class="coin-name">{hiveAssetName}</span>
			<span class="coin-sub">Native Hive Token</span>
		</div>
		<span class="row-amount">{formatWithUnit(new CoinAmount($accountBalance.bal.hive, Coin.hive, true), hiveAssetName, '320.00 HIVE')}</span>
	</div>

	<div class="balance-row">
		<div class="row-icon consensus"><img src={Coin.hive.icon} alt="" /></div>
		<div class="row-info">
			<span class="coin-name">{hiveAssetName} Consensus</span>
			<span class="coin-sub">Hive Consensus</span>
		</div>
		<span class="row-amount">{formatWithUnit(new CoinAmount($accountBalance.bal.hive_consensus, Coin.hive, true), hiveAssetName, '1,150.00 HIVE')}</span>
	</div>

	{#if $accountBalance.bal.consensus_unstaking !== 0}
		<div class="balance-row">
			<div class="row-icon hive"><img src={Coin.hive.icon} alt="" /></div>
			<div class="row-info">
				<span class="coin-name">{hiveAssetName} Unstaking</span>
			</div>
			<span class="row-amount">{formatWithUnit(new CoinAmount($accountBalance.bal.consensus_unstaking, Coin.hive, true), hiveAssetName)}</span>
		</div>
	{/if}
</div>

<style lang="scss">
	.balances-list {
		display: flex;
		flex-direction: column;
	}

	.balances-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.625rem;
	}
	.balances-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.see-all {
		color: var(--dash-accent-purple);
		font-size: 0.8rem;
		font-weight: 500;
		text-decoration: none;
	}
	.see-all:hover {
		text-decoration: underline;
	}

	.balance-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--dash-divider);
	}
	.balance-row:last-child {
		border-bottom: none;
	}

	.row-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.row-icon img {
		width: 36px;
		height: 36px;
		border-radius: 50%;
	}

	.row-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
		min-width: 0;
	}
	.coin-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--dash-text-primary);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.coin-sub {
		font-size: 0.75rem;
		color: var(--dash-text-muted);
		font-weight: 400;
	}
	.tooltip-inline {
		display: inline-flex;
		vertical-align: middle;
	}

	.row-amount {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--dash-text-primary);
		white-space: nowrap;
		margin-left: auto;
		flex-shrink: 0;
	}
</style>
