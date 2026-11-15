<!--
	The wallet page's shared chrome: the account total, and the tab row that
	moves between Assets / Transactions / Transfer / Deposit / Withdraw.

	Applied from `(authed)/+layout.svelte` to every route in `WALLET_TABS`, so
	each of those pages renders only its own content and inherits this.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { sumBalance } from '$lib/stores/balanceHistory';
	import { numberFormatLanguage } from '$lib/constants';
	import { WALLET_TABS, activeWalletTab } from './walletTabs';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const active = $derived(activeWalletTab(page.url.pathname));

	/**
	 * The total is summed from the CURRENT balances, not from the last point
	 * of `accountBalanceHistory`.
	 *
	 * The history is only ever filled by `fetchAndStoreAccountBalances`, which
	 * runs inside the dashboard's Balance card. Nothing on these pages mounts
	 * it, so the history stays empty here and reading its last point reported
	 * a confident $0.00 over a wallet with money in it. `sumBalance` is what
	 * the history itself is built out of, so this is the same number by a
	 * shorter route — and it is the number the asset rows below add up to.
	 */
	let total = $state(0);
	$effect(() => {
		const bal = $accountBalance.bal;
		let live = true;
		sumBalance(bal).then((value) => {
			if (live) total = value;
		});
		return () => {
			live = false;
		};
	});

	const loading = $derived($accountBalance.loading);
	const totalCents = $derived(Math.round(total * 100));
	const dollars = $derived(Math.floor(totalCents / 100));
	const cents = $derived(
		new Intl.NumberFormat(numberFormatLanguage, {
			minimumIntegerDigits: 2,
			maximumFractionDigits: 0
		}).format(totalCents % 100)
	);

	/**
	 * Transactions can show ANOTHER account's history via `?account=`. The
	 * total is always the signed-in account's, so printing it over someone
	 * else's history would read as theirs. Hide it rather than explain it.
	 */
	const viewingOther = $derived(!!page.url.searchParams.get('account')?.trim());
</script>

<div class="wallet">
	<!-- The tab row leads, and the title and total sit under it. The tabs are
	     what the reader came here to use; the total is what they came to read,
	     and it belongs with the content it sums rather than above the
	     navigation. -->
	<nav class="tabs" aria-label="Wallet sections">
		{#each WALLET_TABS as tab (tab.href)}
			<a
				class={['tab', { active: tab.href === active?.href }]}
				href={tab.href}
				aria-current={tab.href === active?.href ? 'page' : undefined}
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	<header>
		<div class="title-area">
			<h1>Wallet</h1>
			{#if !viewingOther}
				<div class="total" class:loading>
					<span class="dollars">${dollars.toLocaleString(numberFormatLanguage)}</span><span
						class="cents">.{cents}</span
					>
				</div>
			{/if}
		</div>
	</header>

	<div class="tab-body">
		{@render children()}
	</div>
</div>

<style lang="scss">
	.wallet {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-height: 0;
	}
	header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0 0 2px;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.02em;
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

	/* The handoff's segmented toggle, sized up for navigation rather than a
	   two-way filter. It scrolls rather than wraps: a tab row that reflows to
	   two lines stops reading as one control. */
	.tabs {
		display: flex;
		align-items: center;
		gap: 2px;
		align-self: flex-start;
		max-width: 100%;
		padding: 3px;
		border-radius: 999px;
		background: var(--alt-field);
		border: 1px solid var(--alt-field-border);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
		padding: 8px 16px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 700;
		color: var(--alt-mut);
		text-decoration: none;
		white-space: nowrap;
	}
	.tab:hover {
		color: var(--alt-tx-2);
	}
	.tab.active {
		background: var(--alt-chip-hover);
		color: var(--alt-tx);
	}

	/*
	 * Phones: the row is wider than the screen, so let it run edge to edge and
	 * scroll rather than being clipped mid-tab inside the page gutter. The
	 * negative margin cancels `main`'s 16px padding; the matching padding
	 * keeps the first and last tab off the screen edge.
	 */
	@media (max-width: 560px) {
		.tabs {
			/* There is no global border-box in this project, so the inline
			   padding below would otherwise be ADDED to max-width and the row
			   would end up 32px wider than the screen it is bleeding to. */
			box-sizing: border-box;
			margin-inline: -16px;
			padding-inline: 16px;
			max-width: calc(100% + 32px);
			border-radius: 0;
			border-left: 0;
			border-right: 0;
			background: transparent;
		}
		.tab {
			padding: 8px 13px;
		}
		.dollars {
			font-size: 30px;
		}
		h1 {
			font-size: 14px;
		}
	}

	/* Deposit and Withdraw lay themselves out as full-height flex columns. */
	.tab-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
