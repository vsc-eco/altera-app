<script lang="ts">
	import type { UnkCoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { getHiveAssetName, getHbdAssetName } from '../../../../../client';

	type Props = {
		amount: UnkCoinAmount;
		direction?: 'incoming' | 'outgoing' | 'swap' | 'contract';
	};
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
	<span
		class={[
			'token',
			{
				green: direction === 'incoming'
			}
		]}
	>
		{#if amount}
			{displayUnit}
		{/if}
	</span>
</td>

<style>
	.token {
		color: var(--dash-text-secondary);
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
	}

	.token.green {
		color: var(--dash-accent-green-light);
	}

	td:has(.token) {
		padding-left: 0;
	}
</style>
