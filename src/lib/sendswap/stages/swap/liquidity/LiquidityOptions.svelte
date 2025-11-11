<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import LiquidityPoolInfo from '$lib/sendswap/components/info/LiquidityPoolInfo.svelte';
	import { untrack } from 'svelte';
	import { LiquidityPool } from './liquidity';
	import LiquiditySelect from './LiquiditySelect.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import swapOptions, { Network } from '$lib/sendswap/utils/sendOptions';

	let {
		editStage,
		onHomePage = $bindable()
	}: {
		editStage: (complete: boolean) => void;
		onHomePage: boolean;
	} = $props();

	let currentlySelected: LiquidityPool = $state(LiquidityPool.btcHbd);

	let poolSelectOpen = $state(false);

	const selectItems = Object.values(LiquidityPool).map((lp) => ({
		...lp,
		component: LiquidityPoolInfo
	}));

	let coin1Amt = $state('');
	let coin2Amt = $state('');
	const coinOpt1 = $derived(
		swapOptions.from.coins.find((coinOpt) => coinOpt.coin.value === currentlySelected.coin1.value)
	);
	const coinOpt2 = $derived(
		swapOptions.from.coins.find((coinOpt) => coinOpt.coin.value === currentlySelected.coin2.value)
	);
</script>

{#if poolSelectOpen}
	<LiquiditySelect
		items={selectItems}
		bind:selected={currentlySelected}
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
				<LiquidityPoolInfo item={currentlySelected} />
				<span class="edit">Edit</span>
			</div>
		</ClickableCard>
		<div class="inputs">
			<AmountInput amount={coin1Amt} coinOpt={coinOpt1} network={Network.magi} />
			<AmountInput amount={coin2Amt} coinOpt={coinOpt2} network={Network.magi} />
		</div>
	</div>
{/if}

<style lang="scss">
	.liquidity-wrapper {
		display: flex;
		flex-direction: column;
		.lp-card {
			display: flex;
			justify-content: space-between;
			align-items: center;
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
