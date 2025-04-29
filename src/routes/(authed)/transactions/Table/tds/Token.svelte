<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';

	type Props = {
		amount: UnkCoinAmount;
	};
	let { amount }: Props = $props();
</script>

<td>
	<span
		class={[
			'token',
			{
				primary: !amount.isNegative(),
				neutral: amount.isNegative()
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
		color: var(--fg-mid);
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
	}

	.token.neutral {
		color: var(--fg-accent);
	}

	td:has(.token) {
		padding-left: 0;
	}
</style>
