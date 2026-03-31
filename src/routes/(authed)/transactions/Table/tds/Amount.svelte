<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';

	type Props = { amount: UnkCoinAmount; direction?: 'incoming' | 'outgoing' | 'swap' | 'contract' };
	let { amount, direction = 'incoming' }: Props = $props();
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
</td>

<style>
	.amount {
		font-family: 'Nunito Sans', sans-serif;
		font-size: var(--text-sm);
		color: var(--dash-text-primary);
	}
	.amount.green {
		color: var(--dash-accent-green-light);
	}
	td:has(.amount) {
		padding-right: 0.5rem;
		text-align: right;
	}
</style>
