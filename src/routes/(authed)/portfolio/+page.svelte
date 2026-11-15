<!--
	The wallet's Assets tab.

	The page title, the account total and the tab row all come from
	`WalletChrome`, applied in `(authed)/+layout.svelte` — this renders only
	what is specific to Assets. There are no Deposit/Swap buttons here any
	more: Deposit and Withdraw are tabs in that row, and Swap is its own
	destination in the top bar, so a button for either would be a second way
	to reach a place already on screen.
-->
<script lang="ts">
	import AccBalance from '$lib/AccBalance.svelte';
	import AssetBalanceChart from '$lib/cards/Balance/AssetBalanceChart.svelte';
	import { getAuth } from '$lib/auth/store';

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);
</script>

<svelte:head>
	<title>Wallet · Assets</title>
</svelte:head>

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

<style lang="scss">
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
