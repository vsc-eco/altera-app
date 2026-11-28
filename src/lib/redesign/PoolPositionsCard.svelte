<!--
	What the account has sitting in liquidity pools.

	The Assets card beside this one counts only what is spendable: liquidity
	is held by the pool contract, not by the account, so a reader who had put
	most of their money to work saw a wallet total far smaller than their
	balance and nothing on the page to explain where the rest went. This is
	that money, named.

	Positions come from `poolPositions`, shared with the "Pools" figure in the
	wallet header so the pool list is read once for both.
-->
<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import PairIcons from '$lib/pools/PairIcons.svelte';
	import { poolPositions, loadPoolPositions } from '$lib/stores/poolPositions';
	import { formatUsd } from '$lib/calc';

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);

	$effect(() => {
		if (did) void loadPoolPositions(did);
	});

	/** Positions for the account signed in RIGHT NOW. Between a switch and
	 *  the next load the store still holds the previous account's rows, and
	 *  showing those under a new name would be a lie about their money. */
	const mine = $derived($poolPositions.did === did ? $poolPositions : undefined);
	/** Biggest position first. The order they arrive in is the indexer's, which
	 *  is nothing a reader can see; what they want to know is where the money
	 *  mostly is. */
	const rows = $derived(
		[...(mine?.rows ?? [])].sort((a, b) => b.myLiquidityUsdRaw - a.myLiquidityUsdRaw)
	);

	/**
	 * The two amounts in the order the PAIR LABEL reads.
	 *
	 * `myAmounts` follows the pool's own asset order (alphabetical), while
	 * `pair` and `displaySymbols` put HBD second. For a pool whose other asset
	 * sorts after "hbd" the two disagree, and the row read
	 * "LASSECASH:HBD — 5.551 HBD · 18,210.7 LASSECASH": the label naming one
	 * asset first and the amounts under it the other.
	 */
	function orderedAmounts(row: {
		pairSymbols: [string, string];
		displaySymbols: [string, string];
		myAmounts: [string, string];
	}): [string, string] {
		const flipped = row.displaySymbols[0].toLowerCase() !== row.pairSymbols[0].toLowerCase();
		return flipped ? [row.myAmounts[1], row.myAmounts[0]] : row.myAmounts;
	}
</script>

<section class="alt-card pools">
	<div class="card-head">
		<h2>In pools</h2>
		{#if rows.length > 0}
			<span class="total">{formatUsd(mine?.totalUsd ?? 0)}</span>
		{/if}
	</div>

	<p class="note">Your share of each pool, priced at today's rates. Earns a cut of its fees.</p>

	{#if !did}
		<p class="msg">Connect a wallet to see your liquidity.</p>
	{:else if mine?.loading}
		<p class="msg">Loading…</p>
	{:else if mine?.failed}
		<p class="msg">
			Couldn't read the pools.
			<button type="button" class="retry" onclick={() => did && loadPoolPositions(did, true)}>
				Try again
			</button>
		</p>
	{:else if rows.length === 0}
		<p class="msg">
			Nothing in pools.
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static route -->
			<a href="/pools">Add liquidity</a> to earn a share of trading fees.
		</p>
	{:else}
		<ul class="rows">
			{#each rows as row (row.id)}
				{@const amounts = orderedAmounts(row)}
				<li class="row">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static route -->
					<a class="link" href="/pools">
						<PairIcons symbols={row.displaySymbols} size={1.6} />
						<span class="info">
							<span class="name">{row.pair}</span>
							<span class="sub">{amounts[0]} · {amounts[1]}</span>
						</span>
						<span class="value">
							<span class="amount">{row.myLiquidityUsd}</span>
							<span class="share">{row.sharePct.toFixed(2)}% of pool</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="scss">
	.pools {
		padding: 18px;
		min-width: 0;
	}
	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.total {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: 14px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.note {
		margin: 6px 0 12px;
		font-size: 12px;
		color: var(--alt-mut);
	}
	.msg {
		margin: 0;
		font-size: 14px;
		color: var(--alt-mut);
	}
	.msg a {
		color: var(--alt-tx);
		font-weight: 600;
	}
	.retry {
		padding: 0;
		border: 0;
		background: none;
		color: var(--alt-tx);
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.row {
		min-width: 0;
		border-bottom: 1px solid var(--alt-card-border);
	}
	.row:last-child {
		border-bottom: 0;
	}
	/* The whole row is the link: a position is only ever acted on from
	   /pools, and a reader who taps the pair name expects to land there. */
	.link {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		min-width: 0;
		text-decoration: none;
		color: inherit;
	}
	.row:last-child .link {
		padding-bottom: 0;
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.name {
		font-size: 14px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.sub {
		font-size: 12px;
		color: var(--alt-mut);
		overflow-wrap: anywhere;
	}
	.value {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		flex: none;
	}
	.amount {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: 14px;
		font-weight: 600;
		color: var(--alt-tx);
	}
	.share {
		font-size: 11px;
		color: var(--alt-mut);
		white-space: nowrap;
	}
	.link:hover .name {
		text-decoration: underline;
	}
</style>
