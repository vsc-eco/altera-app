<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';

	type Props = { fromOrTo: 'from' | 'to' | string; amount: UnkCoinAmount };
	let { fromOrTo, amount }: Props = $props();
	console.log(fromOrTo, amount);
</script>

<td>
	<span
		class={[
			'amount',
			{
				primary: fromOrTo == 'from' || amount.amount > 0,
				neutral: fromOrTo == 'to' || amount.amount < 0
			}
		]}
	>
		{#if amount}
			{#if fromOrTo == 'to'}
				-
			{:else}
				&nbsp;
			{/if}{amount.toPrettyAmountString()}
		{:else}
			invalid
		{/if}
	</span>
</td>

<style>
	.amount {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
		color: var(--fg-mid);
	}
	.amount.neutral {
		color: var(--fg-accent);
	}
	td:has(.amount) {
		padding-right: 0.5rem;
		text-align: right;
	}
</style>
