<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Balance from '$lib/cards/Balance/Balance.svelte';
	import PortfolioValue from '$lib/cards/Balance/PortfolioValue.svelte';
	import StakingEarnings from '$lib/cards/StakingEarnings.svelte';
	import TopHomeMenu from './TopHomeMenu.svelte';
	import { getAccountNameFromAuth, getUsernameFromAuth } from '$lib/getAccountName';
	import Table from './transactions/Table/Table.svelte';
	import QuickSwap from '$lib/cards/QuickSwap.svelte';
	import ResourceCredits from '$lib/cards/ResourceCredits/ResourceCredits.svelte';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import StakePopup from '$lib/magiTransactions/hive/vscOperations/StakePopup.svelte';
	import { goto } from '$app/navigation';
	// let { auth }: LayoutData = $props();
	let auth = $derived(getAuth()());
	let username: string | undefined = $derived(getAccountNameFromAuth(auth));
	let stakeOpen = $state(false);
	let toggleStake = $state<(open?: boolean) => void>(() => {});
</script>

<document:head>
	<title>Home</title>
</document:head>

<h1>
	<span class="welcome-text">Welcome,</span>
	<span class={['name', { loaded: !!username }]}>
		{#if username}
			<BasicCopy value={getUsernameFromAuth(auth)!}>
				{username}
			</BasicCopy>
		{:else}
			&nbsp;
		{/if}
	</span>
</h1>

<TopHomeMenu {auth} />
<div class="masonry">
	<div class="top-grid">
		<div class="col-left">
			<Balance> </Balance>
		</div>
		<div class="col-right">
			{#if auth.value}
				<PortfolioValue />
				<div class="staking-card-wrapper">
					<StakingEarnings onStake={() => toggleStake(true)} />
				</div>
			{/if}
		</div>
	</div>

	<div class="txs-row">
		<div class="txs-col">
			<div class="txs-header">
				<h3>Transactions</h3>
				<select class="filter-select" aria-label="Filter transactions">
					<option>All</option>
				</select>
			</div>
			{#if auth.value}
				<Table did={auth.value.did} allowPopup={false} limit={10} />
			{/if}
			{#if auth.value}
				<button type="button" class="more-txs-btn" onclick={() => goto('/transactions')}>
					More transactions
				</button>
			{/if}
		</div>
		<div class="right-col">
			{#if auth.value}
				<div class="quick-swap-col">
					<QuickSwap />
				</div>
				<div class="resource-credits-col">
					<ResourceCredits
						{username}
						isHive={auth.value == undefined || auth.value!.username != undefined}
					/>
				</div>
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
	}
	.top-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: stretch;
		width: 100%;
	}
	.col-left {
		flex: 1 1 40%;
		min-width: 280px;
		max-width: 45%;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		box-sizing: border-box;
	}
	.col-right {
		flex: 1 1 55%;
		min-width: 300px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		box-sizing: border-box;
	}
	@media (max-width: 900px) {
		.col-left,
		.col-right {
			flex: 1 1 100%;
			max-width: none;
		}
	}
	.col-left > :global(*) {
		flex: 1 1 0;
		min-height: 0;
		min-width: 0;
	}
	.txs-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: stretch;
		width: 100%;
	}
	.txs-col {
		flex: 1 1 50%;
		min-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.75rem;
		padding: 0.5rem;
		box-shadow: 0 0 4px oklch(from var(--dark-purple) l c h / 0.1);
		box-sizing: border-box;
	}
	.right-col {
		flex: 1 1 340px;
		min-width: 280px;
		max-width: 320px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		box-sizing: border-box;
	}
	.quick-swap-col,
	.resource-credits-col {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.more-txs-btn {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 2rem;
		color: var(--primary-text);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		width: 100%;
	}
	.more-txs-btn:hover {
		background: var(--neutral-bg-accent);
	}
	.txs-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.txs-header h3 {
		color: var(--primary-text);
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.filter-select {
		background: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.5rem;
		color: var(--primary-text);
		font-size: var(--text-sm);
		padding: 0.25rem 1.5rem 0.25rem 0.5rem;
		cursor: pointer;
	}
	@media (max-width: 700px) {
		.txs-col,
		.right-col {
			flex: 1 1 100%;
			max-width: none;
		}
	}
	h1 {
		font-size: var(--text-4xl);
		margin: calc(var(--text-4xl) / 2) 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
	}
	.welcome-text {
		color: var(--primary-text);
	}
	.name {
		width: 100%;
		max-width: min(100%, 17ch);
		min-width: fit-content;
		display: inline-flex;
		justify-content: left;
		border-radius: 0.5rem;

		padding: 0.25rem 0.25rem;
		color: transparent;
		background-color: var(--neutral-bg-accent);
		transition:
			background-color 0.5s 0.3s ease-out,
			color 0.5s ease-in;
	}
	.name.loaded {
		width: fit-content;
		color: currentColor;
		background-color: transparent;
	}
	.staking-card-wrapper {
		width: 100%;
	}
</style>
