<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';

	type Props = {
		amount: UnkCoinAmount;
		outgoing?: boolean;
	};
	let { amount, outgoing = false }: Props = $props();
</script>

<td>
	<span
		class={[
			'token',
			{
				neutral: outgoing
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
		color: var(--green-fg);
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
	}

	.token.neutral {
		color: var(--neutral-off-fg);
	}

	td:has(.token) {
		padding-left: 0;
	}
</style>
