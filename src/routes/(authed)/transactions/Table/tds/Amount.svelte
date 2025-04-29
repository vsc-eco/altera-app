<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';

	type Props = { amount: UnkCoinAmount };
	let { amount }: Props = $props();
</script>

<td>
	<span
		class={[
			'amount',
			{
				primary: !amount.isNegative(),
				neutral: amount.isNegative()
			}
		]}
	>
		{#if amount}
			{amount.toPrettyAmountString()}
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
