<script lang="ts">
	import AccBalance from '$lib/AccBalance.svelte';
	import AssetBalanceChart from '$lib/cards/Balance/AssetBalanceChart.svelte';
	import { getAuth } from '$lib/auth/store';
	import { accountBalanceHistory } from '$lib/stores/balanceHistory';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { numberFormatLanguage } from '$lib/constants';
	import { goto } from '$app/navigation';

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);

	/** The same figure the wallet card shows: the latest point of the balance
	 *  history, which `AccBalance` keeps current as balances poll in. */
	const total = $derived(
		$accountBalanceHistory.length > 0
			? $accountBalanceHistory[$accountBalanceHistory.length - 1].value
			: 0
	);
	const loading = $derived($accountBalance.loading);

	const totalCents = $derived(Math.round(total * 100));
	const dollars = $derived(Math.floor(totalCents / 100));
	const cents = $derived(
		new Intl.NumberFormat(numberFormatLanguage, {
			minimumIntegerDigits: 2,
			maximumFractionDigits: 0
		}).format(totalCents % 100)
	);
</script>

<svelte:head>
	<title>Portfolio</title>
</svelte:head>

<div class="portfolio">
	<div class="head">
		<div class="title-area">
			<h1>Portfolio</h1>
			<div class="total" class:loading>
				<span class="dollars">${dollars.toLocaleString(numberFormatLanguage)}</span><span
					class="cents">.{cents}</span
				>
			</div>
		</div>
		<div class="actions">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static route; resolve() not exported in this kit version -->
			<button class="alt-btn-secondary" onclick={() => goto('/deposit')}>Deposit</button>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static route; resolve() not exported in this kit version -->
			<button class="pri" onclick={() => goto('/swap')}>Swap</button>
		</div>
	</div>

	<div class="grid">
		<section class="alt-card assets">
			<h2>Assets</h2>
			{#if did}
				<AccBalance {did} />
			{:else}
				<p class="empty">Connect a wallet to see your balances.</p>
			{/if}
		</section>

		<section class="alt-card history">
			<h2>Balance by asset</h2>
			<AssetBalanceChart {did} />
		</section>
	</div>
</div>

<style lang="scss">
	.portfolio {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0 0 6px;
		font-size: 22px;
		font-weight: 700;
		color: var(--alt-tx-2);
	}
	.total {
		display: flex;
		align-items: flex-start;
		transition: opacity 0.2s;
	}
	.total.loading {
		opacity: 0.55;
	}
	.dollars {
		font-size: 38px;
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--alt-tx);
	}
	.cents {
		font-size: 16px;
		font-weight: 600;
		color: var(--alt-tx);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.actions button {
		padding: 0 18px;
		height: 44px;
	}
	.pri {
		border: 0;
		border-radius: 18px;
		background: var(--alt-pri);
		box-shadow: var(--alt-pri-shadow);
		color: #fff;
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}
	.pri:hover {
		filter: brightness(1.08);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
		gap: 16px;
		align-items: start;
	}
	section {
		padding: 18px;
		min-width: 0;
	}
	h2 {
		margin: 0 0 10px;
		font-size: 16px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.empty {
		color: var(--alt-mut);
		font-size: 14px;
		margin: 0;
	}
</style>
