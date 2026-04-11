<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { getHiveAssetName, getHbdAssetName } from '../../../../../client';

	type Props = { amount: UnkCoinAmount; direction?: 'incoming' | 'outgoing' | 'swap' | 'contract' };
	let { amount, direction = 'incoming' }: Props = $props();

	const displayUnit = $derived(
		amount?.coin.value === Coin.hive.value
			? getHiveAssetName()
			: amount?.coin.value === Coin.hbd.value
				? getHbdAssetName()
				: amount?.coin.unit ?? ''
	);
</script>

<td>
	{#if direction === 'contract'}
		<span class="sm-caption">Limit:</span>
	{/if}
	<span
		class={[
			'amount',
			{
				green: direction === 'incoming'
			}
		]}
	>
		{#if amount}
			{(direction === 'outgoing' ? '-' : '') + amount.toPrettyAmountString()}
		{:else}
			invalid
		{/if}
	</span>
	{#if amount}
		<span class={['token', { green: direction === 'incoming' }]}>{displayUnit}</span>
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
		text-align: right;
	}
</style>
