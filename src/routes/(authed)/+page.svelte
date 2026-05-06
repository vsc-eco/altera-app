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
	<div class="area-balance">
		<Balance />
	</div>

	<div class="area-portfolio">
		<PortfolioValue />
		<StakingEarnings onStake={() => toggleStake(true)} />
	</div>

	<div class="area-rc-market">
		{#if auth.value}
			<ResourceCredits {username} />
		{/if}
		<MarketPrices />
	</div>

	<div class="area-quickswap">
		<QuickSwap />
	</div>

	<div class="area-transactions">
		<div class="card transactions-card">
			<div class="card-header">
				<h4>Transaction</h4>
				<button class="filter-btn" onclick={() => goto('/transactions')}>
					All <span class="dropdown-arrow">&#9662;</span>
				</button>
			</div>
			<div class="table-body">
				{#if auth.value}
					<Table did={auth.value.did} allowPopup={false} limit={12} size="small" />
				{/if}
			</div>
		</div>
	</div>
</div>

{#if auth.value}
	<StakePopup {auth} bind:dialogOpen={stakeOpen} bind:toggle={toggleStake} />
{/if}

<style lang="scss">
	/* ── Shared card chrome (scoped to dashboard wrapper only) ──────────── */

	.dashboard-wrapper {
		:global(.dashboard-card),
		:global(.card) {
			border-color: rgba(255, 255, 255, 0.12) !important;
			transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			&:hover {
				transform: translateY(-1px);
			}
		}
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
		height: 100%;
		box-sizing: border-box;
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

	/* ── Areas that stack children vertically ────────────────────────────── */

	.area-portfolio,
	.area-rc-market {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* ── Default: 1 column (< 1024px) ───────────────────────────────────── */
	/*  DOM order already matches desired visual order:
	    balance → portfolio/staking → rc+market → quickswap → transactions  */

	.dashboard-wrapper {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		padding-bottom: 2rem;
	}

	/* ── 2-column layout (1024px – 1919px) ──────────────────────────────── */
	/*  Row 1: balance | portfolio+staking
	    Row 2: rc+market | quickswap
	    Row 3: transactions (full width)                                      */

	@media (min-width: 1024px) and (max-width: 1919px) {
		.dashboard-wrapper {
			display: grid;
			grid-template-columns: 1fr 1fr;
			grid-template-areas:
				'balance   portfolio'
				'rc-mkt    quickswap'
				'txs       txs';
			align-items: start;
		}

		.area-balance {
			grid-area: balance;
			align-self: stretch;
			display: flex;
			flex-direction: column;
		}
		/* Make the Balance component fill the stretched area */
		.area-balance > :global(*) {
			flex: 1;
		}
		.area-portfolio { grid-area: portfolio; }
		.area-rc-market {
			grid-area: rc-mkt;
			align-self: stretch;
		}
		/* Both cards grow equally to fill remaining height */
		.area-rc-market > :global(*) {
			flex: 1;
		}
		.area-quickswap {
			grid-area: quickswap;
			height: 755px;
			overflow: hidden;
		}
		.area-transactions {
			grid-area: txs;
			max-height: 755px;
			display: flex;
			flex-direction: column;
		}
		.area-transactions .transactions-card {
			flex: 1;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.area-transactions .table-body {
			flex: 1;
			overflow-y: auto;
			min-height: 0;
		}
	}

	/* ── 3-column layout (≥ 1920px) ─────────────────────────────────────── */
	/*  5-column grid (each unit = 1/5):
	    Row 1: balance(2) | portfolio+staking(2) | rc+market(1)
	    Row 2: quickswap(2) | transactions(3) — same height, table scrollable */

	@media (min-width: 1920px) {
		.dashboard-wrapper {
			display: grid;
			grid-template-columns: repeat(5, 1fr);
			grid-template-areas:
				'balance   balance   portfolio  portfolio  rc-mkt'
				'quickswap quickswap txs        txs        txs';
			/* row 1 items sit at their natural height */
			align-items: start;
		}

		.area-balance { grid-area: balance; }
		.area-portfolio { grid-area: portfolio; }
		.area-rc-market { grid-area: rc-mkt; }

		/* quickswap: fixed height prevents layout shifts when swap details
		   appear/disappear. This also defines the row track height so
		   the transactions card stretches to exactly the same size. */
		.area-quickswap {
			grid-area: quickswap;
			align-self: start;
			height: 755px;
			overflow: hidden;
		}
		.area-transactions {
			grid-area: txs;
			align-self: start;
			max-height: 755px;
			display: flex;
			flex-direction: column;
		}
		.area-transactions .transactions-card {
			flex: 1;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.area-transactions .table-body {
			flex: 1;
			overflow-y: auto;
			min-height: 0;
		}
	}

	/* ── Mobile tweaks (≤ 600px) ─────────────────────────────────────────── */

	@media (max-width: 600px) {
		.dashboard-wrapper {
			gap: 12px;
		}
		.card {
			padding: 1rem;
			border-radius: 20px;
		}
	}
</style>
