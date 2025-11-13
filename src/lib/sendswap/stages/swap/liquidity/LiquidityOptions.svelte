<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import LiquidityPoolInfo from '$lib/sendswap/components/info/LiquidityPoolInfo.svelte';
	import { LiquidityPool, LiquidityTxDetails } from './liquidity';
	import LiquiditySelect from './LiquiditySelect.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Shuffle } from '@lucide/svelte';

	let {
		editStage,
		onHomePage = $bindable()
	}: {
		editStage: (complete: boolean) => void;
		onHomePage: boolean;
	} = $props();

	let poolSelectOpen = $state(false);

	const selectItems = Object.values(LiquidityPool).map((lp) => ({
		...lp,
		component: LiquidityPoolInfo
	}));

	let coin1Amt = $state(new CoinAmount(0, Coin.unk));
	let coin2Amt = $state(new CoinAmount(0, Coin.unk));

	$effect(() => {
		if (
			coin1Amt.coin.value !== $LiquidityTxDetails.amount1.coin.value ||
			coin1Amt.amount !== $LiquidityTxDetails.amount1.amount
		) {
			$LiquidityTxDetails.amount1 = coin1Amt;
		}
	});
	$effect(() => {
		if (
			coin2Amt.coin.value !== $LiquidityTxDetails.amount2.coin.value ||
			coin2Amt.amount !== $LiquidityTxDetails.amount2.amount
		) {
			$LiquidityTxDetails.amount2 = coin2Amt;
		}
	});

	$effect(() => {
		if (
			$LiquidityTxDetails.pool &&
			$LiquidityTxDetails.amount1.amount > 0 &&
			$LiquidityTxDetails.amount2.amount > 0
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});
</script>

{#if poolSelectOpen}
	<LiquiditySelect
		items={selectItems}
		bind:selected={$LiquidityTxDetails.pool}
		close={() => (poolSelectOpen = false)}
	/>
{:else}
	<div class="liquidity-wrapper">
		<h2>Manage Liquidity</h2>
		<ClickableCard
			onclick={() => {
				poolSelectOpen = true;
			}}
		>
			<div class="lp-card">
				{#if $LiquidityTxDetails.pool}
					<LiquidityPoolInfo item={$LiquidityTxDetails.pool} />
				{:else}
					<Shuffle size={40} />
					<span>Select a Liquidity Pool</span>
				{/if}
				<span class="edit">Edit</span>
			</div>
		</ClickableCard>
		{#if $LiquidityTxDetails.pool}
			<div class="inputs">
				<AmountInput
					bind:coinAmount={coin1Amt}
					coinOpts={[{ coin: $LiquidityTxDetails.pool.coin1, network: Network.magi }]}
					connectedCoinAmount={coin2Amt}
				/>
				<AmountInput
					bind:coinAmount={coin2Amt}
					coinOpts={[{ coin: $LiquidityTxDetails.pool.coin2, network: Network.magi }]}
					connectedCoinAmount={coin1Amt}
				/>
			</div>
		{/if}
	</div>
{/if}

<style lang="scss">
	.liquidity-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.lp-card {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.5rem;
			span {
				font-size: var(--text-sm);
				color: var(--primary-fg-mid);
			}
		}
	}
	.inputs {
		padding: 0.5rem 0;
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
</style>
