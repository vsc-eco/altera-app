<script lang="ts" generics="Option extends { label: string, [key: string]: any }">
	import { ArrowRightLeft, BadgeDollarSign } from '@lucide/svelte';
	import { Coin, SendAccount } from '$lib/sendswap/utils/sendOptions';
	import { isValidBalanceField, sumBalance, type BalanceOption } from '$lib/stores/balanceHistory';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import InfoSegment from './InfoSegment.svelte';
	import type { LiquidityPool } from '$lib/sendswap/stages/swap/liquidity/liquidity';

	let {
		item
	}: {
		item: Option;
	} = $props();
</script>

<div class="wrapper">
	<div class="images">
		<img src={item.coin1.icon} alt={item.coin1.label} />
		<ArrowRightLeft />
		<img src={item.coin2.icon} alt={item.coin2.label} />
	</div>
	<InfoSegment label={item.label} />
</div>

<style lang="scss">
	.wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.images {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		img {
			width: 2.5rem;
			height: 2.5rem;
		}
	}
</style>
