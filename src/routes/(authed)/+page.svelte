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
	<title>Dashboard</title>
</document:head>

<div class="dashboard-wrapper">
	<!-- Main dashboard (left) -->
	<div class="dashboard-main">
		<!-- Top row: Balance + Portfolio/Staking -->
		<div class="top-row">
			<div class="balance-col">
				<Balance />
			</div>
			<div class="right-col">
				<PortfolioValue />
				<StakingEarnings onStake={() => toggleStake(true)} />
			</div>
		</div>

		<!-- Bottom row: Transactions -->
		<div class="transactions-section">
			<div class="card transactions-card">
				<div class="card-header">
					<h4>Transaction</h4>
					<button class="filter-btn" onclick={() => goto('/transactions')}>
						All <span class="dropdown-arrow">&#9662;</span>
					</button>
				</div>
				{#if auth.value}
					<Table did={auth.value.did} allowPopup={false} limit={10} size="small" />
				{/if}
			</div>
		</div>
	</div>

	<!-- Right panel -->
	<div class="dashboard-right">
		<MarketPrices />
		<QuickSwap />
		{#if auth.value}
			<ResourceCredits
				{username}
				isHive={auth.value == undefined || auth.value!.username != undefined}
			/>
		{/if}
	</div>
</div>

{#if auth.value}
	<StakePopup {auth} bind:dialogOpen={stakeOpen} bind:toggle={toggleStake} />
{/if}

<style lang="scss">
	.dashboard-wrapper {
		display: flex;
		gap: 16px;
		width: 100%;
		padding-bottom: 2rem;
		align-items: flex-start;
	}

	/* Main area — locked to SVG proportions */
	.dashboard-main {
		flex: 0 0 auto;
		width: min(1100px, 65%);
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Right panel — fills ALL remaining space */
	.dashboard-right {
		flex: 1 1 0;
		min-width: 280px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		position: sticky;
		top: 1rem;
	}

	.top-row {
		display: grid;
		grid-template-columns: 37fr 63fr;
		gap: 16px;
		align-items: stretch;
	}

	.balance-col {
		min-width: 0;
	}

	.right-col {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.transactions-section {
		min-width: 0;
	}

	.card {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		padding: 1.25rem;
		box-shadow: var(--dash-card-shadow);
	}

	.transactions-card {
		overflow: hidden;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.card-header h4 {
		color: var(--dash-text-primary);
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0;
	}

	.filter-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: none;
		border: 1px solid var(--dash-card-border);
		border-radius: 0.375rem;
		color: var(--dash-text-secondary);
		font-size: 0.8rem;
		font-weight: 500;
		padding: 0.25rem 0.625rem;
		cursor: pointer;
		font-family: inherit;
		transition: border-color 0.15s;
	}
	.filter-btn:hover {
		border-color: var(--dash-accent-purple);
		color: var(--dash-text-primary);
	}
	.dropdown-arrow {
		font-size: 0.65rem;
		opacity: 0.6;
	}

	@media (max-width: 1200px) {
		.dashboard-wrapper {
			flex-direction: column;
		}
		.dashboard-right {
			width: 100%;
			position: static;
			flex-direction: row;
			flex-wrap: wrap;
		}
		.dashboard-right > :global(*) {
			flex: 1 1 280px;
		}
	}

	@media (max-width: 900px) {
		.top-row {
			grid-template-columns: 1fr;
		}
	}
</style>
