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
	import PopOut from '$lib/redesign/PopOut.svelte';
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
			<AccBalance {did} actions />
		{:else}
			<p class="empty">Connect a wallet to see your balances.</p>
		{/if}
	</section>

	<section class="alt-card history">
		<div class="card-head">
			<h2>Balance by asset</h2>
			<PopOut title="Balance by asset">
				{#snippet content(room)}
					<!-- `room` is the height the dialog body has for us. The chart
					     draws a caption row above the plot and a legend plus
					     footnote below it — 116px together, measured — so the plot
					     takes what is left of that, and never less than 260, below
					     which the pop-out would not be showing anything bigger. -->
					<AssetBalanceChart {did} zoomable height={Math.max(260, room - 120)} />
				{/snippet}
			</PopOut>
		</div>
		<AssetBalanceChart {did} />
	</section>
</div>

<style lang="scss">
	.grid {
		display: grid;
		/* `min(380px, 100%)` and not a bare 380px: a bare floor cannot shrink
		   below 380 even when the column is narrower than that, so on a phone
		   the cards ran 22px past the viewport. */
		grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr));
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
	/* The pop-out trigger rides on the card's title row. The h2 keeps its own
	   bottom margin so this card's heading still lines up with the Assets
	   card's next to it. */
	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.empty {
		color: var(--alt-mut);
		font-size: 14px;
		margin: 0;
	}
</style>
