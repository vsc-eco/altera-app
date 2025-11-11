<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import LiquidityPoolInfo from '$lib/sendswap/components/info/LiquidityPoolInfo.svelte';
	import { untrack } from 'svelte';
	import { LiquidityPool } from './liquidity';
	import LiquiditySelect from './LiquiditySelect.svelte';

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
</style>
