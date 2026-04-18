<script lang="ts">
	import { Layers, ArrowUpDown, BarChart2, ChevronUp, ChevronDown } from '@lucide/svelte';
	import { fetchPools, fetchMyPoolPositions, type TimeRange } from './poolsData';
	import type { PoolRow, MyPoolRow } from './poolsData';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import AddLiquidityPopup from './AddLiquidityPopup.svelte';
	import RemoveLiquidityPopup from './RemoveLiquidityPopup.svelte';
	import PoolDetail from './PoolDetail.svelte';
	import { getAuth } from '$lib/auth/store';

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

	let pools = $state<PoolRow[]>([]);
	let loading = $state(false);
	let selectedPool = $state<PoolRow | null>(null);

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);
	let myPools = $state<MyPoolRow[]>([]);
	let myPoolsLoading = $state(false);
	// PoolRow subset for pools the user has LP in — passed to the
	// Remove Liquidity dialog so it only lists pools the user can
	// actually withdraw from.
	const myPoolsAsRows = $derived(
		pools.filter((p) => myPools.some((mp) => mp.contractId === p.contractId))
	);

	$effect(() => {
		const range = timeRange;
		loading = true;
		fetchPools(range).then((result) => {
			pools = result;
			loading = false;
		});
	});

	$effect(() => {
		const currentDid = did;
		const currentPools = pools;
		if (!currentDid || currentPools.length === 0) {
			myPools = [];
			return;
		}
		let cancelled = false;
		myPoolsLoading = true;
		fetchMyPoolPositions(currentDid, currentPools)
			.then((rows) => {
				if (cancelled) return;
				myPools = rows;
			})
			.catch((err) => {
				console.error('Failed to fetch user pool positions', err);
				if (!cancelled) myPools = [];
			})
			.finally(() => {
				if (!cancelled) myPoolsLoading = false;
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
		<PoolDetail pool={selectedPool} onback={() => (selectedPool = null)} />
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
			{#each timeRangeLabels as tr}
				<button
					type="button"
					class="time-btn"
					class:active={timeRange === tr.value}
					onclick={() => (timeRange = tr.value)}
				>
					{tr.label}
				</button>
			{/each}
		</div>
	</div>

	{@render poolsTable(sortedPools)}

	<div class="action-buttons">
		<button class="action-btn" onclick={() => (addLiquidityOpen = true)}>Add Liquidity</button>
		<button class="action-btn" onclick={() => (removeLiquidityOpen = true)}>Remove Liquidity</button>
	</div>

	{#if did && (myPools.length > 0 || myPoolsLoading)}
		<div class="my-pools-section">
			<h3 class="section-title">
				My liquidity
				{#if myPoolsLoading}<span class="muted">loading…</span>{/if}
			</h3>
			{#if myPools.length > 0}
				{@render myPoolsTable(myPools)}
			{:else if !myPoolsLoading}
				<p class="placeholder-text">No active LP positions.</p>
			{/if}
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
						<button type="button" class="col-heading-btn" onclick={(e) => toggleSort('liquidity', e)}>
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
						<button type="button" class="col-heading-btn" onclick={(e) => toggleSort('volume', e)}>
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
				</tr>
			</thead>
			<tbody>
				{#each rows as pool (pool.id)}
					<tr class="clickable" onclick={() => (selectedPool = pool)}>
						<td class="col-pair">
							<div class="pair-cell">
								<span class="pair-icons" aria-hidden="true">
									{#if getCoinIcon(pool.pairSymbols[0])}
										<img class="coin-icon icon-a" src={getCoinIcon(pool.pairSymbols[0])} alt={pool.pairSymbols[0]} />
									{:else}
										<span class="icon icon-a"></span>
									{/if}
									{#if getCoinIcon(pool.pairSymbols[1])}
										<img class="coin-icon icon-b" src={getCoinIcon(pool.pairSymbols[1])} alt={pool.pairSymbols[1]} />
									{:else}
										<span class="icon icon-b"></span>
									{/if}
								</span>
								<span class="pair-label">{pool.pair}</span>
							</div>
						</td>
						<td class="col-price">
							<div class="price-cell">
								<span>{pool.priceRatio}</span>
								<span>{pool.priceInverse}</span>
								<span class="price-usd">
									{pool.priceUsd[0]}, {pool.priceUsd[1]}
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
							<div class="amount-cell">
								<span class="total">{pool.feeEarnedUsd}</span>
								<span class="breakdown">{pool.feeEarnedAssets[0]}</span>
								<span class="breakdown">{pool.feeEarnedAssets[1]}</span>
							</div>
						</td>
						<td class="col-volume">
							<div class="amount-cell">
								<span class="total">{pool.volumeUsd}</span>
								<span class="breakdown">{pool.volumeAssets[0]}</span>
								<span class="breakdown">{pool.volumeAssets[1]}</span>
							</div>
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
										<img class="coin-icon icon-a" src={getCoinIcon(row.pairSymbols[0])} alt={row.pairSymbols[0]} />
									{:else}
										<span class="icon icon-a"></span>
									{/if}
									{#if getCoinIcon(row.pairSymbols[1])}
										<img class="coin-icon icon-b" src={getCoinIcon(row.pairSymbols[1])} alt={row.pairSymbols[1]} />
									{:else}
										<span class="icon icon-b"></span>
									{/if}
								</span>
								<span class="pair-label">{row.pair}</span>
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

<AddLiquidityPopup bind:open={addLiquidityOpen} {pools} />
<RemoveLiquidityPopup bind:open={removeLiquidityOpen} pools={myPoolsAsRows} {myPools} />
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
			outline: 2px solid #6F6AF8;
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
		transition: background-color 0.1s, color 0.1s;
		&:hover {
			background-color: var(--dash-surface-alt);
			color: var(--dash-text-primary);
		}
		&.active {
			background-color: #6F6AF8;
			color: #FFFFFF;
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

	.action-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		padding: 0.75rem 0 0;
	}

	.action-btn {
		font-family: 'Nunito Sans', sans-serif;
		font-size: var(--text-sm);
		font-weight: 600;
		color: white;
		background: linear-gradient(135deg, #7B74FF 0%, #6F6AF8 40%, #5B54E0 100%);
		border: none;
		border-radius: 1.5rem;
		padding: 0.5rem 1rem;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(111, 106, 248, 0.25);
		&:hover:not(:disabled) {
			box-shadow: 0 6px 24px rgba(111, 106, 248, 0.4);
		}
		&:active:not(:disabled) {
			transform: scale(0.97);
		}
		&:disabled {
			opacity: 0.4;
			cursor: not-allowed;
			box-shadow: none;
		}
	}

	.placeholder-text {
		color: var(--dash-text-muted);
		padding: 0.5rem 0;
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
	.muted {
		font-weight: 500;
		font-size: 0.7rem;
		color: var(--dash-text-muted);
	}
	.share-pct,
	.lp-amount {
		color: var(--dash-text-primary);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
</style>
