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
	import { sHbdAprStore } from '$lib/stores/aprStore';
	import {
		ACTION_LABEL,
		actionsForCoin,
		assetActionHref,
		type AssetAction
	} from '$lib/redesign/assetActions';
	import { ArrowDownToLine, ArrowUpFromLine, Send } from '@lucide/svelte';

	type Props = {
		did: string;
		/** Show the per-asset Transfer / Deposit / Withdraw icons. Off by
		 *  default so the classic dashboard's Balance card is unchanged. */
		actions?: boolean;
	};
	let { did, actions = false }: Props = $props();

	const ACTION_ICON = {
		transfer: Send,
		deposit: ArrowDownToLine,
		withdraw: ArrowUpFromLine
	} satisfies Record<AssetAction, unknown>;

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

{#snippet rowActions(coinValue: string, assetLabel: string)}
	{#if actions}
		{@const available = actionsForCoin(coinValue)}
		{#if available.length > 0}
			<div class="row-actions">
				{#each available as action (action)}
					{@const Icon = ACTION_ICON[action]}
					<a
						class="row-action"
						href={assetActionHref(action, coinValue)}
						title="{ACTION_LABEL[action]} {assetLabel}"
						aria-label="{ACTION_LABEL[action]} {assetLabel}"
					>
						<Icon size={14} aria-hidden="true" />
					</a>
				{/each}
			</div>
		{/if}
	{/if}
{/snippet}

<div class="balances-list" class:has-actions={actions}>
	<div class="balance-row">
		<div class="row-icon hbd"><img src={Coin.hbd.icon} alt="" /></div>
		<div class="row-info">
			<div class="name-row">
				<span class="coin-name">{hbdAssetName}</span>
				<span class="row-amount"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true),
						hbdAssetName
					)}</span
				>
			</div>
			<span class="coin-sub">Hive Backed Dollar</span>
		</div>
		{@render rowActions(Coin.hbd.value, hbdAssetName)}
	</div>

	<div class="balance-row">
		<div class="row-icon shbd"><img src={Coin.hbd.icon} alt="" /></div>
		<div class="row-info">
			<div class="name-row">
				<span class="coin-name">
					s{hbdAssetName}
					<span class="tooltip-inline"
						><InfoToolip
							>s{hbdAssetName} is {hbdAssetName} that remains transferable while earning {$sHbdAprStore !==
							null
								? `${$sHbdAprStore}%`
								: '~12%'} APR</InfoToolip
						></span
					>
				</span>
				<span class="row-amount"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hbd_savings, Coin.hbd, true),
						hbdAssetName
					)}</span
				>
			</div>
			<span class="coin-sub">Liquid Hive Dollar Savings</span>
		</div>
		{@render rowActions(Coin.shbd.value, `s${hbdAssetName}`)}
	</div>

	{#if $accountBalance.bal.pending_hbd_unstaking && $accountBalance.bal.pending_hbd_unstaking !== 0}
		<div class="balance-row">
			<div class="row-icon hbd"><img src={Coin.hbd.icon} alt="" /></div>
			<div class="row-info">
				<div class="name-row">
					<span class="coin-name">{hbdAssetName} Unstaking</span>
					<span class="row-amount"
						>{formatWithUnit(
							new CoinAmount($accountBalance.bal.pending_hbd_unstaking, Coin.hbd, true),
							hbdAssetName
						)}</span
					>
				</div>
			</div>
		</div>
	{/if}

	<div class="balance-row">
		<div class="row-icon hive"><img src={Coin.hive.icon} alt="" /></div>
		<div class="row-info">
			<div class="name-row">
				<span class="coin-name">{hiveAssetName}</span>
				<span class="row-amount"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hive, Coin.hive, true),
						hiveAssetName
					)}</span
				>
			</div>
			<span class="coin-sub">Native Hive Token</span>
		</div>
		{@render rowActions(Coin.hive.value, hiveAssetName)}
	</div>

	<div class="balance-row">
		<div class="row-icon consensus"><img src={Coin.hive.icon} alt="" /></div>
		<div class="row-info">
			<div class="name-row">
				<span class="coin-name">{hiveAssetName} Consensus</span>
				<span class="row-amount"
					>{formatWithUnit(
						new CoinAmount($accountBalance.bal.hive_consensus, Coin.hive, true),
						hiveAssetName
					)}</span
				>
			</div>
			<span class="coin-sub">Hive Consensus</span>
		</div>
	</div>

	{#if $accountBalance.bal.consensus_unstaking !== 0}
		<div class="balance-row">
			<div class="row-icon hive"><img src={Coin.hive.icon} alt="" /></div>
			<div class="row-info">
				<div class="name-row">
					<span class="coin-name">{hiveAssetName} Unstaking</span>
					<span class="row-amount"
						>{formatWithUnit(
							new CoinAmount($accountBalance.bal.consensus_unstaking, Coin.hive, true),
							hiveAssetName
						)}</span
					>
				</div>
			</div>
		</div>
	{/if}

	<div class="balance-row">
		<div class="row-icon btc"><img src={Coin.btc.icon} alt="Bitcoin" /></div>
		<div class="row-info">
			<div class="name-row">
				<span class="coin-name">Bitcoin</span>
				<span class="row-amount"
					>{new CoinAmount($accountBalance.bal.btc, Coin.btc, true).toPrettyString()}</span
				>
			</div>
			<span class="coin-sub">Bitcoin Native Asset Mapping</span>
		</div>
		{@render rowActions(Coin.btc.value, 'Bitcoin')}
	</div>
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

	.name-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.125rem 0.5rem;
		min-width: 0;
	}

	.coin-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--dash-text-primary);
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
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

	/* Quick actions for this asset. They sit at the end of the row and stay
	   dim until the row is hovered, so a list of five assets does not read as
	   fifteen buttons — but they are always reachable (and always visible to
	   keyboard and touch, which have no hover). */
	.row-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
		margin-left: 0.5rem;
	}
	.row-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 9px;
		color: var(--alt-mut, var(--dash-text-muted));
		text-decoration: none;
		opacity: 0.75;
		transition:
			opacity 0.15s,
			color 0.15s,
			background 0.15s;
	}
	.balance-row:hover .row-action,
	.row-action:focus-visible {
		opacity: 1;
	}
	.row-action:hover {
		background: var(--alt-chip-hover, rgba(255, 255, 255, 0.12));
		color: var(--alt-tx, var(--dash-text-primary));
		opacity: 1;
	}
	@media (hover: none) {
		.row-action {
			opacity: 1;
		}
	}

	.row-amount {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--dash-text-primary);
		white-space: nowrap;
		flex-shrink: 0;
	}
</style>
