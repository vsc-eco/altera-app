<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';

	type Props = { amount: UnkCoinAmount; outgoing?: boolean };
	let { amount, outgoing = false }: Props = $props();
</script>

<td>
	<span
		class={[
			'amount',
			{
				neutral: outgoing
			}
		]}
	>
		{#if amount}
			{(outgoing ? '-' : '') + amount.toPrettyAmountString()}
		{:else}
			invalid
		{/if}
	</span>
</td>

<style>
	.amount {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
		color: var(--green-fg);
	}
	.amount.neutral {
		color: var(--neutral-off-fg);
	}
	td:has(.amount) {
		padding-right: 0.5rem;
		text-align: right;
	}
</style>
