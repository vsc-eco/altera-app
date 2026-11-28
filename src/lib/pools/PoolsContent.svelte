<script lang="ts">
	import {
		Layers,
		ArrowUpDown,
		BarChart2,
		ChevronUp,
		ChevronDown,
		Plus,
		Minus
	} from '@lucide/svelte';
	import {
		cachedPools,
		fetchPools,
		fetchMyPoolPositions,
		poolKind,
		type TimeRange
	} from './poolsData';
	import type { PoolRow, MyPoolRow, PoolKind } from './poolsData';
	import AddLiquidityPopup from './AddLiquidityPopup.svelte';
	import RemoveLiquidityPopup from './RemoveLiquidityPopup.svelte';
	import PoolDetail from './PoolDetail.svelte';
	import { getAuth } from '$lib/auth/store';
	import { openConnect } from '$lib/auth/connectModal';
	import { isDeprecatedPool } from '../../client';
	import { registrationHint } from './routerRegistry';
	import PairIcons from './PairIcons.svelte';
	import { Hint } from '$lib/ui';
	import { ETH_CHAIN_ID } from '$lib/constants';
	import { poolNetworkLabel } from './network';

	/** Which slice of the registry this instance shows. The Pools and Custom
	 *  pools tabs render the same component; only this prop differs, so every
	 *  downstream consumer (table, My liquidity, the Add/Remove pool pickers,
	 *  the detail view) stays scoped to the tab the user is on. */
	let { kind = 'standard' }: { kind?: PoolKind } = $props();

	let searchQuery = $state('');
	let timeRange = $state<TimeRange>('30d');
	let addLiquidityOpen = $state(false);
	let removeLiquidityOpen = $state(false);
	// Preselected pool for Add/Remove popups when launched via a row
	// button. Cleared back to null when the popup closes so the global
	// "Add Liquidity" / "Remove Liquidity" buttons still open the popups
	// without any pre-selection.
	let addPrefillPool = $state<PoolRow | null>(null);
	let removePrefillPool = $state<PoolRow | null>(null);

	function openAddForPool(pool: PoolRow) {
		// Pools is public; providing liquidity is not. Ask for a wallet in
		// place rather than opening a form that cannot be submitted.
		if (!did) return openConnect();
		addPrefillPool = pool;
		addLiquidityOpen = true;
	}
	function openRemoveForPool(pool: PoolRow) {
		removePrefillPool = pool;
		removeLiquidityOpen = true;
	}
	$effect(() => {
		if (!addLiquidityOpen) addPrefillPool = null;
	});
	$effect(() => {
		if (!removeLiquidityOpen) removePrefillPool = null;
	});

	let pools = $state<PoolRow[]>([]);
	let loading = $state(true);
	let selectedPool = $state<PoolRow | null>(null);

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);
	let myPools = $state<MyPoolRow[]>([]);
	// PoolRow subset for pools the user has LP in — passed to the
	// Remove Liquidity dialog so it only lists pools the user can
	// actually withdraw from.
	const myPoolsAsRows = $derived(
		pools.filter((p) => myPools.some((mp) => mp.contractId === p.contractId))
	);

	// True while the rows on screen are the last list kept from a previous
	// load (cachedPools) and fresh numbers are on their way. Add/Remove stay
	// disabled meanwhile: the liquidity dialogs compute with a row's reserves.
	// Stays true when the refresh fails, rather than act on old reserves.
	let refreshing = $state(false);

	$effect(() => {
		const range = timeRange;
		// Read synchronously so the effect tracks it; reading `kind` inside the
		// `.then` callback would leave this effect subscribed to `timeRange` only.
		const wanted = kind;
		let cancelled = false;
		const cached = cachedPools(range);
		if (cached) {
			pools = cached.filter((p) => poolKind(p) === wanted);
			loading = false;
			refreshing = true;
		} else {
			loading = true;
		}
		fetchPools(range).then((result) => {
			// Guard against out-of-order resolves: if the range changed while
			// this fetch was in flight, drop the stale result so it can't
			// overwrite the newer range's numbers.
			if (cancelled) return;
			// A failed fetch returns []: keep the last list (still refreshing)
			// instead of blanking the page.
			if (result.length === 0 && cached) return;
			pools = result.filter((p) => poolKind(p) === wanted);
			loading = false;
			refreshing = false;
		});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const currentDid = did;
		const currentPools = pools;
		if (!currentDid || currentPools.length === 0) {
			myPools = [];
			return;
		}
		let cancelled = false;
		fetchMyPoolPositions(currentDid, currentPools)
			.then((rows) => {
				if (cancelled) return;
				myPools = rows;
			})
			.catch((err) => {
				console.error('Failed to fetch user pool positions', err);
				if (!cancelled) myPools = [];
			});
		return () => {
			cancelled = true;
		};
	});

	type SortColumn = 'liquidity' | 'fee' | 'volume';
	let sortColumn = $state<SortColumn>('liquidity');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	function parseUsd(s: string): number {
		const n = s.replace(/[$,]/g, '');
		return Number.parseFloat(n) || 0;
	}
	function getSortValue(pool: PoolRow, col: SortColumn): number {
		if (col === 'liquidity') return parseUsd(pool.totalLiquidityUsd);
		if (col === 'fee') return parseUsd(pool.feeEarnedUsd);
		return parseUsd(pool.volumeUsd);
	}
	let lastSortClickAt = $state(0);
	function toggleSort(col: SortColumn, e?: MouseEvent) {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		const now = Date.now();
		if (now - lastSortClickAt < 300) return;
		lastSortClickAt = now;
		if (sortColumn === col) {
			sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
		} else {
			sortColumn = col;
			sortDirection = 'desc';
		}
	}

	const timeRangeLabels: { value: TimeRange; label: string }[] = [
		{ value: '1d', label: '1 day' },
		{ value: '7d', label: '7 Days' },
		{ value: '30d', label: '30 Days' },
		{ value: 'max', label: 'Max' }
	];

	const filteredPools = $derived(
		pools.filter((p) => {
			const q = searchQuery.trim().toLowerCase();
			if (!q) return true;
			return p.pair.toLowerCase().includes(q);
		})
	);

	const sortedPools = $derived(
		[...filteredPools].sort((a, b) => {
			const va = getSortValue(a, sortColumn);
			const vb = getSortValue(b, sortColumn);
			const cmp = va - vb;
			return sortDirection === 'desc' ? -cmp : cmp;
		})
	);
</script>

{#if selectedPool}
	<div class="pools-content">
		<PoolDetail pool={selectedPool} {pools} {myPools} onback={() => (selectedPool = null)} />
	</div>
{:else}
	<div class="pools-content">
		<div class="toolbar">
			<input
				type="search"
				class="search-input"
				placeholder="Search..."
				bind:value={searchQuery}
				aria-label="Search pools"
			/>
			{#if refreshing}
				<span class="refresh-note" aria-live="polite">Updating…</span>
			{/if}
			<div class="time-filters" role="group" aria-label="Time range">
				{#each timeRangeLabels as tr (tr.value)}
					<button
						type="button"
						class="filter-chip"
						class:on={timeRange === tr.value}
						disabled={loading}
						onclick={() => (timeRange = tr.value)}
					>
						{tr.label}
					</button>
				{/each}
			</div>
		</div>

		{@render poolsTable(sortedPools)}

		<!-- Only render once we actually have positions. Gating on `myPoolsLoading`
	     too caused the section to flash in and out on every filter change (the
	     position fetch re-runs when `pools` is reassigned, finds none, hides). -->
		{#if did && myPools.length > 0}
			<div class="my-pools-section">
				<h3 class="section-title">
					My liquidity
					<Hint
						size={15}
						text="The pools you have deposited into. Open one to add more, or to take it back out."
					/>
				</h3>
				{@render myPoolsTable(myPools)}
			</div>
		{/if}
	</div>

	{#snippet poolsTable(rows: PoolRow[])}
		<div class="table-wrapper">
			<table class="pools-table">
				<thead>
					<tr>
						<th class="col-pair">Pair</th>
						<th class="col-price">
							Price
							<Hint
								size={14}
								text="What one unit of each side is worth in the other, taken from the pool's own reserves. The dollar figures underneath are the same two prices in USD."
							/>
						</th>
						<th class="col-liquidity sortable" class:active={sortColumn === 'liquidity'}>
							<button
								type="button"
								class="col-heading-btn"
								onclick={(e) => toggleSort('liquidity', e)}
							>
								<Layers size={16} aria-hidden="true" />
								Total Liquidity
								{#if sortColumn === 'liquidity'}
									{#if sortDirection === 'desc'}
										<ChevronDown size={16} aria-label="descending" />
									{:else}
										<ChevronUp size={16} aria-label="ascending" />
									{/if}
								{/if}
							</button>
							<Hint
								size={14}
								text="Everything the pool currently holds, valued in USD, with the two asset amounts underneath. A deeper pool moves its price less when you swap."
							/>
						</th>
						<th class="col-fee sortable" class:active={sortColumn === 'fee'}>
							<button type="button" class="col-heading-btn" onclick={(e) => toggleSort('fee', e)}>
								<ArrowUpDown size={16} aria-hidden="true" />
								Fee Earned
								{#if sortColumn === 'fee'}
									{#if sortDirection === 'desc'}
										<ChevronDown size={16} aria-label="descending" />
									{:else}
										<ChevronUp size={16} aria-label="ascending" />
									{/if}
								{/if}
							</button>
							<Hint size={14}>
								Fees this pool charged over the selected period, split two ways:
								<br /><b>LP</b> goes to whoever provided the liquidity — your share of it is
								proportional to your share of the pool.
								<br /><b>Protocol</b> goes to the network.
							</Hint>
						</th>
						<th class="col-volume sortable" class:active={sortColumn === 'volume'}>
							<button
								type="button"
								class="col-heading-btn"
								onclick={(e) => toggleSort('volume', e)}
							>
								<BarChart2 size={16} aria-hidden="true" />
								Volume
								{#if sortColumn === 'volume'}
									{#if sortDirection === 'desc'}
										<ChevronDown size={16} aria-label="descending" />
									{:else}
										<ChevronUp size={16} aria-label="ascending" />
									{/if}
								{/if}
							</button>
							<Hint
								size={14}
								text="How much was swapped through this pool over the selected period. Volume is what generates the fees in the column to the left."
							/>
						</th>
						<th class="col-actions" aria-label="Actions"></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as pool (pool.id)}
						{@const deprecated = isDeprecatedPool(pool.contractId)}
						{@const unregistered = !pool.routerRegistered}
						{@const addBlocked = deprecated || unregistered}
						{@const addHint = deprecated
							? 'Deprecated pool — adding liquidity is disabled'
							: unregistered
								? registrationHint(
										{ registered: false, missing: pool.registrationMissing },
										pool.pair
									)
								: undefined}
						{@const network = poolNetworkLabel(pool.pairSymbols, ETH_CHAIN_ID)}
						<tr class="clickable" onclick={() => (selectedPool = pool)}>
							<td class="col-pair" data-label="Pair">
								<div class="pair-cell">
									<PairIcons symbols={pool.displaySymbols} />
									<span
										class="pair-label"
										class:deprecated
										title={deprecated ? 'Deprecated pool — withdraw only' : undefined}
										>{pool.pair}</span
									>
									{#if deprecated}
										<span class="deprecated-tag">deprecated</span>
									{:else if unregistered}
										<!-- Visible as well as hoverable: touch devices have no
									     hover, so a tooltip alone would hide this entirely. -->
										<span class="deprecated-tag unregistered-tag" title={addHint}>not on dex</span>
									{/if}
								</div>
								<!-- Which ETH and USDC these are: the bridge maps them from one
								     chain only, and an EVM address looks the same on all of them. -->
								{#if network}<div class="pair-network">{network}</div>{/if}
							</td>
							<td class="col-price" data-label="Price">
								<div class="price-cell">
									<span>{pool.priceRatio}</span>
									<span>{pool.priceInverse}</span>
									<!-- Labelled: two bare dollar figures side by side gave no
									     clue which asset each belonged to. -->
									<span class="price-usd">
										{pool.pairSymbols[0]}
										{pool.priceUsd[0]} &middot; {pool.pairSymbols[1]}
										{pool.priceUsd[1]}
									</span>
								</div>
							</td>
							<td class="col-liquidity" data-label="Total liquidity">
								<div class="amount-cell">
									<span class="total">{pool.totalLiquidityUsd}</span>
									<span class="breakdown">{pool.totalLiquidityAssets[0]}</span>
									<span class="breakdown">{pool.totalLiquidityAssets[1]}</span>
								</div>
							</td>
							<td class="col-fee" data-label="Fees earned">
								<div class="amount-cell">
									<span class="total">{pool.feeEarnedUsd}</span>
									<span class="breakdown fee-row">
										<span class="fee-label">LP</span>{pool.feeEarnedAssets[0]}
										<span class="fee-sub">{pool.feeEarnedUsdBreakdown[0]}</span>
									</span>
									<span class="breakdown fee-row">
										<span class="fee-label">Protocol</span>{pool.feeEarnedAssets[1]}
										<span class="fee-sub">{pool.feeEarnedUsdBreakdown[1]}</span>
									</span>
								</div>
							</td>
							<td class="col-volume" data-label="Volume">
								<div class="amount-cell">
									<span class="total">{pool.volumeUsd}</span>
									<span class="breakdown">{pool.volumeAssets[0]}</span>
									<span class="breakdown">{pool.volumeAssets[1]}</span>
								</div>
							</td>
							<td class="col-actions" data-label="">
								<div class="row-actions">
									<button
										type="button"
										class="row-action row-action-primary"
										aria-label="Add liquidity to {pool.pair}"
										disabled={addBlocked || refreshing}
										title={refreshing ? 'Updating the pool numbers…' : addHint}
										onclick={(e) => {
											e.stopPropagation();
											if (addBlocked || refreshing) return;
											openAddForPool(pool);
										}}
									>
										<Plus size={14} />
										Add
									</button>
									{#if myPools.some((mp) => mp.contractId === pool.contractId)}
										<button
											type="button"
											class="row-action row-action-outline"
											aria-label="Remove liquidity from {pool.pair}"
											disabled={refreshing}
											title={refreshing ? 'Updating the pool numbers…' : undefined}
											onclick={(e) => {
												e.stopPropagation();
												if (refreshing) return;
												openRemoveForPool(pool);
											}}
										>
											<Minus size={14} />
											Remove
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="empty-cell" colspan="6">
								{#if loading}
									Loading pools…
								{:else if searchQuery.trim()}
									No pools match “{searchQuery.trim()}”.
								{:else if kind === 'custom'}
									No custom token pools yet.
								{:else}
									No pools yet.
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/snippet}

	{#snippet myPoolsTable(rows: MyPoolRow[])}
		<div class="table-wrapper">
			<table class="pools-table">
				<thead>
					<tr>
						<th class="col-pair">Pair</th>
						<th class="col-share">
							My Share
							<Hint
								size={14}
								text="Your LP tokens as a percentage of all of them. It is also the share of this pool's fees that you earn."
							/>
						</th>
						<th class="col-liquidity">My Liquidity</th>
						<th class="col-lp">
							LP Tokens
							<Hint
								size={14}
								text="The receipt for your deposit. Burn them to take your two assets back out, plus the fees they earned while they were in."
							/>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						{@const fullPool = pools.find((p) => p.contractId === row.contractId)}
						{@const network = poolNetworkLabel(row.pairSymbols, ETH_CHAIN_ID)}
						<tr
							class="clickable"
							onclick={() => {
								if (fullPool) selectedPool = fullPool;
							}}
						>
							<td class="col-pair" data-label="Pair">
								<div class="pair-cell">
									<PairIcons symbols={row.displaySymbols} />
									<span class="pair-label" class:deprecated={isDeprecatedPool(row.contractId)}
										>{row.pair}</span
									>
								</div>
								{#if network}<div class="pair-network">{network}</div>{/if}
							</td>
							<td class="col-share" data-label="My share">
								<span class="share-pct">{row.sharePct.toFixed(4)}%</span>
							</td>
							<td class="col-liquidity" data-label="My liquidity">
								<div class="amount-cell">
									<span class="total">{row.myLiquidityUsd}</span>
									<span class="breakdown">{row.myAmounts[0]}</span>
									<span class="breakdown">{row.myAmounts[1]}</span>
								</div>
							</td>
							<td class="col-lp" data-label="LP tokens">
								<span class="lp-amount">{row.lpBalance.toLocaleString()}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/snippet}

	<AddLiquidityPopup
		bind:open={addLiquidityOpen}
		pools={pools.filter((p) => !isDeprecatedPool(p.contractId) && p.routerRegistered)}
		preselectedPool={addPrefillPool}
	/>
	<RemoveLiquidityPopup
		bind:open={removeLiquidityOpen}
		pools={myPoolsAsRows}
		{myPools}
		preselectedPool={removePrefillPool}
	/>
{/if}

<style lang="scss">
	.refresh-note {
		font-size: 0.75rem;
		color: var(--dash-text-muted, rgba(255, 255, 255, 0.6));
		align-self: center;
	}
	.pools-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		padding: 0.5rem 0;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.search-input {
		font: inherit;
		font-family: 'Nunito Sans', sans-serif;
		color: var(--dash-text-primary);
		background-color: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 0.5rem 0.75rem;
		min-width: 10rem;
		&::placeholder {
			color: var(--dash-text-muted);
		}
		&:focus {
			outline: 2px solid #6f6af8;
			outline-offset: 2px;
		}
	}

	.time-filters {
		display: flex;
		gap: 0.25rem;
	}

	.table-wrapper {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		background: var(--dash-card-bg);
		box-shadow: var(--dash-card-shadow);
	}

	.pools-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
		font-family: 'Nunito Sans', sans-serif;
	}

	.pools-table th,
	.pools-table td {
		text-align: left;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--dash-card-border);
		vertical-align: top;
		font-family: 'Nunito Sans', sans-serif;
	}

	.pools-table th {
		color: var(--dash-text-muted);
		font-weight: 500;
		white-space: nowrap;
		background-color: transparent;
	}
	/* A heading is label + (?) — and on a sortable column the label is itself
	   a button, so the row has to be flex rather than inline text. */
	.pools-table th.col-price,
	.pools-table th.col-share,
	.pools-table th.col-lp,
	.pools-table th.sortable {
		> :global(*) {
			vertical-align: middle;
		}
	}

	.pools-table tbody tr:hover {
		background-color: var(--dash-surface-alt);
	}

	.pools-table tbody tr.clickable {
		cursor: pointer;
	}

	.col-heading-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font: inherit;
		font-weight: 500;
		color: var(--dash-text-muted);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		white-space: nowrap;
		&:hover {
			color: var(--dash-accent-purple);
		}
	}

	.pools-table th.sortable.active .col-heading-btn {
		color: var(--dash-accent-purple);
	}

	.pair-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pair-label {
		font-weight: 500;
		color: var(--dash-text-primary);
	}
	/* The network an ETH/USDC pool's tokens are on, on its own line under the
	   icons and the pair: narrower than the pair row above it, so the Pair
	   column keeps its width, in a row the price and fee columns already make
	   taller. */
	.pair-network {
		margin-top: 0.25rem;
		font-size: 0.6875rem;
		line-height: 1.2;
		color: var(--dash-text-muted);
		white-space: nowrap;
	}
	.pair-label.deprecated {
		text-decoration: line-through;
		color: var(--dash-text-muted);
	}
	/* Distinct from `deprecated`: that pool worked once and is being retired;
	   this one has never been reachable through the router. */
	.unregistered-tag {
		color: var(--dash-accent-amber, #e0a94a);
		border-color: currentColor;
		cursor: help;
	}

	.deprecated-tag {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--dash-text-muted);
		border: 1px solid var(--dash-card-border);
		border-radius: 0.75rem;
		padding: 0.05rem 0.4rem;
		opacity: 0.8;
	}

	.price-cell {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.amount-cell {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.price-cell span,
	.amount-cell .breakdown {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
	}

	.price-usd {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
		margin-top: 0.35rem;
	}

	.amount-cell .total {
		color: var(--dash-text-primary);
		font-weight: 500;
	}

	.fee-row {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		flex-wrap: wrap;
	}
	.fee-label {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--dash-text-muted);
		opacity: 0.7;
		flex-shrink: 0;
	}
	.fee-sub {
		color: var(--dash-text-muted);
		font-size: 0.6rem;
		opacity: 0.6;
	}

	.empty-cell {
		color: var(--dash-text-muted);
		text-align: center !important;
		padding: 2rem 1.25rem !important;
		border-bottom: none !important;
	}

	.my-pools-section {
		margin-top: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.section-title {
		margin: 0 0 0.25rem;
		font-family: 'Nunito Sans', sans-serif;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--dash-text-primary);
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.share-pct,
	.lp-amount {
		color: var(--dash-text-primary);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	/* ── Row actions (inline) ── */
	.col-actions {
		width: 1px; /* shrink to content */
		white-space: nowrap;
		padding-right: 0.75rem !important;
	}
	.row-actions {
		display: flex;
		gap: 0.4rem;
		justify-content: flex-end;
	}
	.row-action {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.7rem;
		border-radius: 1.5rem;
		font-family: 'Nunito Sans', sans-serif;
		font-size: var(--text-xs);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s,
			box-shadow 0.15s;
	}
	.row-action-primary {
		border: none;
		color: #fff;
		background: linear-gradient(135deg, #7b74ff 0%, #6f6af8 40%, #5b54e0 100%);
		box-shadow: 0 2px 8px rgba(111, 106, 248, 0.25);
	}
	.row-action-primary:hover:not(:disabled) {
		box-shadow: 0 4px 14px rgba(111, 106, 248, 0.4);
	}
	.row-action:disabled {
		cursor: not-allowed;
		opacity: 0.4;
		box-shadow: none;
		filter: grayscale(0.7);
	}
	.row-action-outline {
		border: 1px solid var(--dash-card-border);
		background: transparent;
		color: var(--dash-text-secondary);
	}
	.row-action-outline:hover {
		border-color: var(--dash-accent-purple);
		color: var(--dash-text-primary);
		background: rgba(111, 106, 248, 0.08);
	}

	/* ──────────────────────────────────────────────────────────────────
	   Phone: the table becomes a list of cards.

	   Six columns cannot fit 390px, and the horizontal scroller it used to
	   fall back to hid the three numbers the page exists for plus the Add
	   button — you had to know to swipe sideways to find them. Each row
	   becomes its own card and each cell a `label · value` line, with the
	   label coming from the `data-label` on the <td>. The markup and the
	   semantics are unchanged; this is only how it lays out.
	   ────────────────────────────────────────────────────────────────── */
	@media (max-width: 760px) {
		.table-wrapper {
			overflow: visible;
			border: 0;
			background: none;
			box-shadow: none;
			border-radius: 0;
		}
		.pools-table,
		.pools-table tbody,
		.pools-table tr,
		.pools-table td {
			display: block;
			width: 100%;
			box-sizing: border-box;
		}
		/* The header row carries the sort controls, so it is not dropped —
		   it moves into the sort bar below instead. */
		.pools-table thead {
			display: block;
		}
		.pools-table thead tr {
			display: flex;
			flex-wrap: wrap;
			gap: 0.35rem;
			border-bottom: 0;
		}
		.pools-table th {
			display: none;
			padding: 0;
			border-bottom: 0;
		}
		.pools-table th.sortable {
			display: inline-flex;
			align-items: center;
			border: 1px solid var(--dash-card-border);
			border-radius: 999px;
			padding: 0.3rem 0.7rem;
		}
		.pools-table th.sortable.active {
			border-color: var(--dash-accent-purple);
		}
		.pools-table th.sortable :global(.hint) {
			display: none;
		}

		.pools-table tbody tr {
			margin-bottom: 0.75rem;
			padding: 0.9rem 1rem;
			border: 1px solid var(--dash-card-border);
			border-radius: 20px;
			background: var(--dash-card-bg);
		}
		.pools-table td {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 0.75rem;
			padding: 0.3rem 0;
			border-bottom: 0;
			text-align: right;
		}
		.pools-table td::before {
			content: attr(data-label);
			flex: 0 0 auto;
			text-align: left;
			color: var(--dash-text-muted);
			font-size: var(--text-xs);
			font-weight: 600;
			padding-top: 0.1rem;
		}
		/* The pair is the card's title, not another labelled line. */
		.pools-table td.col-pair {
			justify-content: flex-start;
			padding-bottom: 0.6rem;
			margin-bottom: 0.3rem;
			border-bottom: 1px solid var(--dash-card-border);
			text-align: left;
		}
		.pools-table td.col-pair::before {
			display: none;
		}
		.price-cell,
		.amount-cell {
			align-items: flex-end;
			min-width: 0;
		}
		.fee-row {
			justify-content: flex-end;
		}
		.pools-table td.col-actions {
			width: auto;
			white-space: normal;
			padding-right: 0 !important;
			padding-top: 0.7rem;
		}
		.pools-table td.col-actions::before {
			display: none;
		}
		.row-actions {
			width: 100%;
		}
		.row-action {
			flex: 1;
			justify-content: center;
			padding: 0.5rem 0.7rem;
		}
		.empty-cell {
			display: block;
			text-align: center !important;
		}
		.empty-cell::before {
			display: none;
		}
		.toolbar {
			gap: 0.5rem;
		}
		.search-input {
			flex: 1 1 100%;
			box-sizing: border-box;
			min-width: 0;
		}
	}
</style>
