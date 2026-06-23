<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { getHiveAssetName, getHbdAssetName } from '../../../../../client';
	import WaveLoading from '$lib/components/WaveLoading.svelte';

	type Props = {
		amount: UnkCoinAmount;
		direction?:
			| 'incoming'
			| 'outgoing'
			| 'swap'
			| 'contract'
			| 'add-liquidity'
			| 'remove-liquidity';
		fromAmount?: UnkCoinAmount | null;
		secondAmount?: UnkCoinAmount | null;
		lpInfo?: string | null;
		// Confirmed swap whose settled output isn't known yet — show a placeholder
		// instead of the slippage floor (which would mis-state what was received).
		pendingAmount?: boolean;
		// Failed tx — nothing was received, so don't show an output amount at all.
		failed?: boolean;
	};
	let {
		amount,
		direction = 'incoming',
		fromAmount = null,
		secondAmount = null,
		lpInfo = null,
		pendingAmount = false,
		failed = false
	}: Props = $props();

	function unitFor(coin: UnkCoinAmount['coin']): string {
		if (coin.value === Coin.hive.value) return getHiveAssetName();
		if (coin.value === Coin.hbd.value) return getHbdAssetName();
		return coin.unit ?? '';
	}

	const displayUnit = $derived(unitFor(amount?.coin));
</script>

<td>
	{#if direction === 'swap' && fromAmount}
		<span class="amount outgoing">{fromAmount.toPrettyAmountString()}</span>
		<span class="token outgoing">{unitFor(fromAmount.coin)}</span>
		<span class="swap-arrow">→</span>
		{#if failed}
			<span class="amount none" title="Swap failed — nothing received">—</span>
		{:else if pendingAmount}
			<span class="amount settling"><WaveLoading size={18} /></span>
		{:else}
			<span class="amount green">{amount.toPrettyAmountString()}</span>
			<span class="token green">{displayUnit}</span>
		{/if}
	{:else if direction === 'add-liquidity' && secondAmount}
		<span class="amount">{amount.toPrettyAmountString()}</span>
		<span class="token">{displayUnit}</span>
		<span class="swap-arrow">+</span>
		<span class="amount">{secondAmount.toPrettyAmountString()}</span>
		<span class="token">{unitFor(secondAmount.coin)}</span>
	{:else if direction === 'remove-liquidity' && secondAmount}
		<span class="amount green">{amount.toPrettyAmountString()}</span>
		<span class="token green">{displayUnit}</span>
		<span class="swap-arrow">+</span>
		<span class="amount green">{secondAmount.toPrettyAmountString()}</span>
		<span class="token green">{unitFor(secondAmount.coin)}</span>
	{:else if direction === 'remove-liquidity' && lpInfo}
		<span class="amount outgoing">{lpInfo}</span>
		<span class="token outgoing">LP</span>
	{:else}
		{#if direction === 'contract'}
			<span class="sm-caption">Limit:</span>
		{/if}
		<span class={['amount', { green: direction === 'incoming' }]}>
			{#if amount}
				{(direction === 'outgoing' ? '-' : '') + amount.toPrettyAmountString()}
			{:else}
				invalid
			{/if}
		</span>
		{#if amount}
			<span class={['token', { green: direction === 'incoming' }]}>{displayUnit}</span>
		{/if}
	{/if}
</td>

<style>
	.amount {
		font-family: 'Nunito Sans', sans-serif;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.amount.green {
		color: var(--dash-accent-green-light);
	}
	.amount.none {
		color: var(--dash-text-muted);
	}
	.token {
		color: var(--dash-text-secondary);
		font-size: var(--text-sm);
		margin-left: 0.25rem;
	}
	.token.green {
		color: var(--dash-accent-green-light);
	}
	td:has(.amount) {
		padding-right: 0.5rem;
		justify-content: flex-end;
		white-space: nowrap;
		gap: 0.2rem;
	}
	.swap-arrow {
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
		margin: 0 0.1rem;
	}
	.outgoing {
		color: var(--dash-text-secondary);
	}
	.amount.settling {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		color: var(--dash-text-muted);
	}
</style>
