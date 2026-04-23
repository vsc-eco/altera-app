<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { getHiveAssetName, getHbdAssetName } from '../../../../../client';

	type Props = {
		amount: UnkCoinAmount;
		direction?: 'incoming' | 'outgoing' | 'swap' | 'contract';
		fromAmount?: UnkCoinAmount | null;
	};
	let { amount, direction = 'incoming', fromAmount = null }: Props = $props();

	const displayUnit = $derived(
		amount?.coin.value === Coin.hive.value
			? getHiveAssetName()
			: amount?.coin.value === Coin.hbd.value
				? getHbdAssetName()
				: amount?.coin.unit ?? ''
	);
</script>

<td>
	{#if direction === 'swap' && fromAmount}
		<span class="amount outgoing">{fromAmount.toPrettyAmountString()}</span>
		<span class="token outgoing">{fromAmount.coin.unit}</span>
		<span class="swap-arrow">→</span>
		<span class="amount green">{amount.toPrettyAmountString()}</span>
		<span class="token green">{displayUnit}</span>
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
</style>
