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
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
		color: var(--neutral-off-fg);
	}
	.amount.green {
		color: var(--green-fg);
	}
	td:has(.amount) {
		padding-right: 0.5rem;
		text-align: right;
	}
</style>
