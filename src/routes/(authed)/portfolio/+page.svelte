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
	import ConnectedWalletCard from '$lib/redesign/ConnectedWalletCard.svelte';
	import { ACTION_LABEL, ASSET_ACTIONS, assetActionHref } from '$lib/redesign/assetActions';
	import { ArrowDownToLine, ArrowUpFromLine, Send } from '@lucide/svelte';
	import { getAuth } from '$lib/auth/store';

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);

	const ACTION_ICON = {
		transfer: Send,
		deposit: ArrowDownToLine,
		withdraw: ArrowUpFromLine
	};
</script>

<svelte:head>
	<title>Wallet · Assets</title>
</svelte:head>

<div class="grid">
	<section class="alt-card assets">
		<div class="card-head">
			<h2>Assets</h2>
			<!-- Once, above the list. Per-row these were three icons on each of
			     five rows — fifteen controls competing with the balances, which
			     are what the list is for. Here they are asset-agnostic: each
			     flow starts on whatever the reader holds. -->
			<div class="asset-actions">
				{#each ASSET_ACTIONS as action (action)}
					{@const Icon = ACTION_ICON[action]}
					{@const href = assetActionHref(action)}
					{@const label = ACTION_LABEL[action]}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static route -->
					<a class="asset-action" {href} title={label} aria-label={label}>
						<Icon size={15} aria-hidden="true" />
					</a>
				{/each}
			</div>
		</div>
		{#if did}
			<AccBalance {did} />
		{:else}
			<p class="empty">Connect a wallet to see your balances.</p>
		{/if}
	</section>

	{#if did}
		<ConnectedWalletCard />
	{/if}

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
		flex-wrap: wrap;
	}
	.asset-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}
	/* Icon-only. The name is carried by `title` and `aria-label`, so it is
	   still reachable by hover, by screen reader and by keyboard focus. */
	.asset-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--alt-field-border);
		border-radius: 10px;
		background: var(--alt-field);
		color: var(--alt-tx-2);
		text-decoration: none;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}
	.asset-action:hover {
		background: var(--alt-chip-hover);
		border-color: var(--alt-card-border);
		color: var(--alt-tx);
	}
	.empty {
		color: var(--alt-mut);
		font-size: 14px;
		margin: 0;
	}
</style>
