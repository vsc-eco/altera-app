<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Balance from '$lib/cards/Balance/Balance.svelte';
	import PortfolioValue from '$lib/cards/Balance/PortfolioValue.svelte';
	import StakingEarnings from '$lib/cards/StakingEarnings.svelte';
	import Table from './transactions/Table/Table.svelte';
	import QuickSwap from '$lib/cards/QuickSwap.svelte';
	import MarketPrices from '$lib/cards/MarketPrices.svelte';
	import ResourceCredits from '$lib/cards/ResourceCredits/ResourceCredits.svelte';
	import StakePopup from '$lib/magiTransactions/hive/vscOperations/StakePopup.svelte';
	import { getAccountNameFromAuth } from '$lib/getAccountName';
	import { goto } from '$app/navigation';

	let auth = $derived(getAuth()());
	let username: string | undefined = $derived(getAccountNameFromAuth(auth));
	let stakeOpen = $state(false);
	let toggleStake = $state<(open?: boolean) => void>(() => {});
</script>

<document:head>
	<title>Home</title>
</document:head>

<div class="masonry">
	<!-- Top Row: Balance + Portfolio/Staking -->
	<div class="row large">
		<Balance />
		{#if auth.value}
			<div class="right-stack">
				<PortfolioValue />
				<StakingEarnings onStake={() => toggleStake(true)} />
			</div>
		{/if}
	</div>

	<!-- Bottom Row: Transactions + QuickSwap/Market/Resources -->
	<div class="row large">
		{#if auth.value}
			<div class="txs-col">
				<div class="recent-txs-card">
					<div class="txs-header">
						<h4>Recent Transactions</h4>
						<button class="view-all-btn" onclick={() => goto('/transactions')}>View All</button>
					</div>
					<Table did={auth.value.did} allowPopup={false} limit={10} />
				</div>
			</div>
		{/if}
		<div class="right-stack">
			{#if auth.value}
				<QuickSwap />
			{/if}
			<MarketPrices />
			{#if auth.value}
				<ResourceCredits
					{username}
					isHive={auth.value == undefined || auth.value!.username != undefined}
				/>
			{/if}
		</div>
	</div>
</div>

{#if auth.value}
	<StakePopup {auth} bind:dialogOpen={stakeOpen} bind:toggle={toggleStake} />
{/if}

<style>
	.masonry {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: 100%;
		box-sizing: border-box;
		padding-bottom: 2rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: stretch;
	}
	.row > :global(*) {
		flex-grow: 1;
		flex-basis: 300px;
		box-sizing: border-box;
	}
	.right-stack {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		flex: 1 1 300px;
		min-width: 0;
	}
	.right-stack > :global(:last-child) {
		flex-shrink: 0;
		flex-grow: 0;
	}
	.txs-col {
		flex: 2 1 400px;
		min-width: 0;
	}
	.recent-txs-card {
		background-color: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 0.75rem;
		padding: 1rem;
		overflow: auto;
	}
	.txs-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.txs-header h4 {
		color: var(--dash-text-primary);
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}
	.view-all-btn {
		background: none;
		border: none;
		color: var(--dash-accent-purple);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0;
		font-weight: 500;
	}
	.view-all-btn:hover {
		text-decoration: underline;
	}

	/* Responsive: single column on small screens */
	@media (max-width: 768px) {
		.row > :global(*) {
			flex-basis: 100%;
		}
		.txs-col {
			flex-basis: 100%;
		}
	}
</style>
