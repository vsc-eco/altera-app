<script lang="ts">
	import {
		Layers,
		ArrowUpDown,
		BarChart2,
		ChevronUp,
		ChevronDown,
		Plus,
		Minus,
		Info
	} from '@lucide/svelte';
	import { portal } from '@zag-js/svelte';
	import { fetchPools, fetchMyPoolPositions, type TimeRange } from './poolsData';
	import type { PoolRow, MyPoolRow } from './poolsData';
	import { fetchSystemHealth, type SystemHealth } from './systemHealth';
	import PoolSystemHealth from './PoolSystemHealth.svelte';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import AddLiquidityPopup from './AddLiquidityPopup.svelte';
	import RemoveLiquidityPopup from './RemoveLiquidityPopup.svelte';
	import PoolDetail from './PoolDetail.svelte';
	import { getAuth } from '$lib/auth/store';
	import { isDeprecatedPool } from '../../client';

	function getCoinIcon(symbol: string): string | undefined {
		const s = symbol.toUpperCase();
		if (s === 'BTC') return Coin.btc.icon;
		if (s === 'HBD') return Coin.hbd.icon;
		if (s === 'HIVE') return Coin.hive.icon;
		return undefined;
	}

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
	// Starts true: we always fetch pools on mount, so the table should show the
	// loading skeleton first rather than flashing an empty "No pools found".
	let loading = $state(true);
	let selectedPool = $state<PoolRow | null>(null);

	// The "where to invest now" snapshot follows the table's time-range selector,
	// so LPs can compare windows themselves: 1d/7d/30d reflect current conditions,
	// while Max shows the annualized since-launch figure (labelled as such). LP
	// fees are lumpy, so each window tells a different story — letting the user
	// pick is the honest way to surface that, and it keeps the row APR and the
	// Fee Earned column on the same window.
	let health = $state<SystemHealth | null>(null);
	$effect(() => {
		const range = timeRange; // re-run whenever the selector changes
		// Poll so the fee split / APR figures track pool balance + fee changes
		// instead of freezing on the mount-time snapshot. 30s — pool-wide fees
		// move slowly; no need to hammer the indexer.
		let cancelled = false;
		const load = () =>
			fetchSystemHealth(range).then((h) => {
				if (!cancelled) health = h;
			});
		load();
		const handle = setInterval(load, 30_000);
		return () => {
			cancelled = true;
			clearInterval(handle);
		};
	});
	// Per-pool LP yield (same window as the table), keyed by pool id, for the rows.
	let lpAprById = $derived(new Map((health?.pools ?? []).map((p) => [p.id, p.lpAprPct])));

	// Fee breakdown "peek" — a single portaled popover positioned at the hovered
	// (or focused) ℹ️ button. Portaled so it escapes the table's overflow (no
	// clipping); hover + focus + tap so it works on desktop, keyboard and touch
	// without fighting the clickable row's navigation.
	let feePeek = $state<{
		rows: PoolRow['feeBreakdown'];
		total: string;
		x: number;
		y: number;
	} | null>(null);
	function openFeePeek(e: { currentTarget: HTMLElement }, pool: PoolRow) {
		const r = e.currentTarget.getBoundingClientRect();
		feePeek = {
			rows: pool.feeBreakdown,
			total: pool.feeEarnedUsd,
			x: r.left + r.width / 2,
			y: r.bottom + 6
		};
	}
	function closeFeePeek() {
		feePeek = null;
	}

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);
	let myPools = $state<MyPoolRow[]>([]);
	// PoolRow subset for pools the user has LP in — passed to the
	// Remove Liquidity dialog so it only lists pools the user can
	// actually withdraw from.
	const myPoolsAsRows = $derived(
		pools.filter((p) => myPools.some((mp) => mp.contractId === p.contractId))
	);

	$effect(() => {
		const range = timeRange;
		let cancelled = false;
		loading = true;
		fetchPools(range).then((result) => {
			// Guard against out-of-order resolves: if the range changed while
			// this fetch was in flight, drop the stale result so it can't
			// overwrite the newer range's numbers.
			if (cancelled) return;
			pools = result;
			loading = false;
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
			<div class="time-filters" role="group" aria-label="Time range">
				{#each timeRangeLabels as tr (tr.value)}
					<button
						type="button"
						class="time-btn"
						class:active={timeRange === tr.value}
						disabled={loading}
						onclick={() => (timeRange = tr.value)}
					>
						{tr.label}
					</button>
				{/each}
			</div>
		</div>

		{@render poolsTable(sortedPools)}

		{#if health}
			<PoolSystemHealth {health} range={timeRange} />
		{/if}

		<!-- Only render once we actually have positions. Gating on `myPoolsLoading`
	     too caused the section to flash in and out on every filter change (the
	     position fetch re-runs when `pools` is reassigned, finds none, hides). -->
		{#if did && myPools.length > 0}
			<div class="my-pools-section">
				<h3 class="section-title">My liquidity</h3>
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
						<th class="col-price">Price</th>
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
						</th>
						<th class="col-actions" aria-label="Actions"></th>
					</tr>
				</thead>
				<tbody>
					{#if loading && rows.length === 0}
						{#each [0, 1, 2] as i (i)}
							<tr class="skeleton-row" aria-hidden="true">
								<td class="col-pair">
									<div class="pair-cell">
										<span class="sk sk-avatars"></span>
										<span class="sk sk-line sk-w-55"></span>
									</div>
								</td>
								<td class="col-price">
									<span class="sk sk-line sk-w-80"></span>
									<span class="sk sk-line sk-w-55"></span>
								</td>
								<td class="col-liquidity"><span class="sk sk-line sk-w-70"></span></td>
								<td class="col-fee"><span class="sk sk-line sk-w-60"></span></td>
								<td class="col-volume"><span class="sk sk-line sk-w-70"></span></td>
								<td class="col-actions"><span class="sk sk-pill"></span></td>
							</tr>
						{/each}
					{:else if rows.length === 0}
						<tr class="empty-row">
							<td colspan="6">No pools found.</td>
						</tr>
					{:else}
						{#each rows as pool (pool.id)}
							{@const deprecated = isDeprecatedPool(pool.contractId)}
							<tr class="clickable" onclick={() => (selectedPool = pool)}>
								<td class="col-pair">
									<div class="pair-cell">
										<span class="pair-icons" aria-hidden="true">
											{#if getCoinIcon(pool.pairSymbols[0])}
												<img
													class="coin-icon icon-a"
													src={getCoinIcon(pool.pairSymbols[0])}
													alt={pool.pairSymbols[0]}
												/>
											{:else}
												<span class="icon icon-a">{pool.pairSymbols[0].slice(0, 3)}</span>
											{/if}
											{#if getCoinIcon(pool.pairSymbols[1])}
												<img
													class="coin-icon icon-b"
													src={getCoinIcon(pool.pairSymbols[1])}
													alt={pool.pairSymbols[1]}
												/>
											{:else}
												<span class="icon icon-b">{pool.pairSymbols[1].slice(0, 3)}</span>
											{/if}
										</span>
										<span
											class="pair-label"
											class:deprecated
											title={deprecated ? 'Deprecated pool — withdraw only' : undefined}
											>{pool.pair}</span
										>
										{#if deprecated}
											<span class="deprecated-tag">deprecated</span>
										{/if}
									</div>
								</td>
								<td class="col-price">
									<div class="price-cell">
										<span class="price-rate">{pool.rateLabel}</span>
										<span class="price-rate">{pool.rateLabelInverse}</span>
										<span class="price-usd-line">
											<span class="price-sym">{pool.pairSymbols[0]}</span>
											{pool.priceUsd[0]}
											<span class="price-dot">·</span>
											<span class="price-sym">{pool.pairSymbols[1]}</span>
											{pool.priceUsd[1]}
										</span>
									</div>
								</td>
								<td class="col-liquidity">
									<div class="amount-cell">
										<span class="total">{pool.totalLiquidityUsd}</span>
										<span class="breakdown">{pool.totalLiquidityAssets[0]}</span>
										<span class="breakdown">{pool.totalLiquidityAssets[1]}</span>
									</div>
								</td>
								<td class="col-fee">
									<div class="amount-cell fee-cell">
										<span class="total">{pool.feeEarnedUsd}</span>
										<button
											type="button"
											class="fee-info-btn"
											aria-label="Show fee breakdown"
											onmouseenter={(e) => openFeePeek(e, pool)}
											onmouseleave={closeFeePeek}
											onfocus={(e) => openFeePeek(e, pool)}
											onblur={closeFeePeek}
											onclick={(e) => e.stopPropagation()}
										>
											<Info size={14} />
										</button>
										{#if lpAprById.get(pool.id) != null}
											<span
												class="lp-apr-tag"
												title="Estimated LP yield from the last 7 days of fees"
											>
												LP APR ≈ {lpAprById.get(pool.id)!.toFixed(2)}% / yr
											</span>
										{/if}
									</div>
								</td>
								<td class="col-volume">
									<div class="amount-cell">
										<span class="total">{pool.volumeUsd}</span>
										<span class="breakdown">{pool.volumeAssets[0]}</span>
										<span class="breakdown">{pool.volumeAssets[1]}</span>
									</div>
								</td>
								<td class="col-actions">
									<div class="row-actions">
										<button
											type="button"
											class="row-action row-action-primary"
											aria-label="Add liquidity to {pool.pair}"
											disabled={deprecated}
											title={deprecated
												? 'Deprecated pool — adding liquidity is disabled'
												: undefined}
											onclick={(e) => {
												e.stopPropagation();
												if (deprecated) return;
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
												onclick={(e) => {
													e.stopPropagation();
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
						{/each}
					{/if}
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
						<th class="col-share">My Share</th>
						<th class="col-liquidity">My Liquidity</th>
						<th class="col-lp">LP Tokens</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						{@const fullPool = pools.find((p) => p.contractId === row.contractId)}
						<tr
							class="clickable"
							onclick={() => {
								if (fullPool) selectedPool = fullPool;
							}}
						>
							<td class="col-pair">
								<div class="pair-cell">
									<span class="pair-icons" aria-hidden="true">
										{#if getCoinIcon(row.pairSymbols[0])}
											<img
												class="coin-icon icon-a"
												src={getCoinIcon(row.pairSymbols[0])}
												alt={row.pairSymbols[0]}
											/>
										{:else}
											<span class="icon icon-a">{row.pairSymbols[0].slice(0, 3)}</span>
										{/if}
										{#if getCoinIcon(row.pairSymbols[1])}
											<img
												class="coin-icon icon-b"
												src={getCoinIcon(row.pairSymbols[1])}
												alt={row.pairSymbols[1]}
											/>
										{:else}
											<span class="icon icon-b">{row.pairSymbols[1].slice(0, 3)}</span>
										{/if}
									</span>
									<span class="pair-label" class:deprecated={isDeprecatedPool(row.contractId)}
										>{row.pair}</span
									>
								</div>
							</td>
							<td class="col-share">
								<span class="share-pct">{row.sharePct.toFixed(4)}%</span>
							</td>
							<td class="col-liquidity">
								<div class="amount-cell">
									<span class="total">{row.myLiquidityUsd}</span>
									<span class="breakdown">{row.myAmounts[0]}</span>
									<span class="breakdown">{row.myAmounts[1]}</span>
								</div>
							</td>
							<td class="col-lp">
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
		pools={pools.filter((p) => !isDeprecatedPool(p.contractId))}
		preselectedPool={addPrefillPool}
	/>
	<RemoveLiquidityPopup
		bind:open={removeLiquidityOpen}
		pools={myPoolsAsRows}
		{myPools}
		preselectedPool={removePrefillPool}
	/>
{/if}

{#if feePeek}
	<div class="fee-peek-pop" use:portal style="left: {feePeek.x}px; top: {feePeek.y}px">
		<div class="fee-pop-head">
			<span class="fee-pop-title">Fee earned</span>
			<span class="fee-pop-total">{feePeek.total}</span>
		</div>
		<div class="fee-pop-split">
			{#each feePeek.rows as row (row.label)}
				<div class="fee-pop-row">
					<span class="fee-pop-label">{row.label}</span>
					<span class="fee-pop-vals">
						<span class="fee-pop-usd">{row.usd}</span>
						<span class="fee-pop-asset">{row.asset}</span>
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style lang="scss">
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

	.time-btn {
		font: inherit;
		font-family: 'Nunito Sans', sans-serif;
		color: var(--dash-text-secondary);
		background-color: var(--dash-surface);
		border: 1px solid var(--dash-card-border);
		border-radius: 1.5rem;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		transition:
			background-color 0.1s,
			color 0.1s;
		&:not(:disabled):hover {
			background-color: var(--dash-surface-alt);
			color: var(--dash-text-primary);
		}
		&.active {
			background-color: #6f6af8;
			color: #ffffff;
		}
		&:disabled {
			cursor: progress;
			opacity: 0.6;
		}
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

	/* Loading skeleton + empty state for the pools table */
	.empty-row td {
		text-align: center;
		color: var(--dash-text-muted);
		padding: 2rem 1.25rem;
	}
	.skeleton-row td {
		vertical-align: middle;
	}
	.sk {
		display: block;
		border-radius: 6px;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 25%,
			rgba(255, 255, 255, 0.09) 37%,
			rgba(255, 255, 255, 0.04) 63%
		);
		background-size: 400% 100%;
		animation: sk-shimmer 1.4s ease infinite;
	}
	.sk-line {
		height: 0.7rem;
		margin: 0.2rem 0;
	}
	.sk-avatars {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.sk-pill {
		width: 62px;
		height: 30px;
		border-radius: 999px;
	}
	.sk-w-55 {
		width: 55%;
	}
	.sk-w-60 {
		width: 60%;
	}
	.sk-w-70 {
		width: 70%;
	}
	.sk-w-80 {
		width: 80%;
	}
	@keyframes sk-shimmer {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sk {
			animation: none;
		}
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

	.pair-icons {
		display: flex;
		align-items: center;
	}

	.pair-icons .icon,
	.pair-icons .coin-icon {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 2px solid var(--dash-bg);
		margin-left: -0.35rem;
	}
	.pair-icons .icon {
		background-color: var(--dash-surface-alt);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.5rem;
		font-weight: 600;
		color: var(--dash-text-secondary);
		letter-spacing: 0.02em;
	}
	.pair-icons .icon:first-child,
	.pair-icons .coin-icon:first-child {
		margin-left: 0;
	}
	.pair-icons .icon-b:not(.coin-icon) {
		background-color: var(--dash-accent-purple);
	}

	.pair-label {
		font-weight: 500;
		color: var(--dash-text-primary);
	}
	.pair-label.deprecated {
		text-decoration: line-through;
		color: var(--dash-text-muted);
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
		gap: 0.3rem;
	}
	.price-rate {
		color: var(--dash-text-primary);
		font-size: var(--text-sm);
		white-space: nowrap;
	}
	.price-usd-line {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		white-space: nowrap;
	}
	.price-sym {
		font-weight: 600;
		opacity: 0.85;
	}
	.price-dot {
		opacity: 0.5;
		margin: 0 0.1rem;
	}

	.amount-cell {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.amount-cell .breakdown {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
	}

	.amount-cell .total {
		color: var(--dash-text-primary);
		font-weight: 500;
	}

	/* Fee cell shows the total + a clear info button; the LP / Nodes / Network
	   split opens in a popover (portaled out of the table's overflow, so it
	   never clips). Full breakdown also lives in the pool detail view. */
	.fee-cell {
		flex-direction: row;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
		width: fit-content;
	}
	.lp-apr-tag {
		flex-basis: 100%;
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		white-space: nowrap;
	}
	.fee-info-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.15rem;
		border: none;
		border-radius: 50%;
		background: rgba(111, 106, 248, 0.14);
		color: var(--dash-accent-purple, #6f6af8);
		cursor: pointer;
		line-height: 0;
		transition: background 0.12s ease;
	}
	.fee-info-btn:hover,
	.fee-info-btn:focus-visible {
		background: rgba(111, 106, 248, 0.28);
	}
	.fee-peek-pop {
		position: fixed;
		transform: translateX(-50%);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		min-width: 13rem;
		padding: 0.6rem 0.7rem;
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.1) 0%,
			rgba(255, 255, 255, 0.05) 100%
		);
		backdrop-filter: blur(10px);
		border: 1px solid var(--dash-card-border);
		border-radius: 12px;
		box-shadow: var(--dash-card-shadow);
		color: var(--dash-text-primary);
		/* Pure informational peek — never intercept clicks. */
		pointer-events: none;
	}
	/* Header: "Fee earned" + the total $ on one line, with a divider. */
	.fee-pop-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.fee-pop-title {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dash-text-muted);
	}
	.fee-pop-total {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--dash-text-primary);
	}
	.fee-pop-split {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.fee-pop-row {
		display: flex;
		justify-content: space-between;
		/* label sits on the first line (the $), token amount drops below it */
		align-items: flex-start;
		gap: 1.25rem;
	}
	.fee-pop-label {
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--dash-text-primary);
	}
	.fee-pop-vals {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.25;
	}
	.fee-pop-asset {
		font-size: 0.72rem;
		color: var(--dash-text-secondary);
	}
	.fee-pop-usd {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--dash-text-primary);
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
</style>
