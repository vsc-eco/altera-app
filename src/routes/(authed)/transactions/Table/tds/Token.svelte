<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';

	type Props = {
		amount: UnkCoinAmount;
		direction?: 'incoming' | 'outgoing' | 'swap' | 'contract';
	};
	let { amount, direction = 'incoming' }: Props = $props();
</script>

<td>
	<span
		class={[
			'token',
			{
				green: direction === 'incoming'
			}
		]}
	>
		{#if amount}
			{amount.coin.unit}
		{/if}
	</span>
</td>

<style>
	.token {
		color: var(--neutral-off-fg);
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
	}

	.token.green {
		color: var(--quaternary-mid);
	}

	td:has(.token) {
		padding-left: 0;
	}
</style>
