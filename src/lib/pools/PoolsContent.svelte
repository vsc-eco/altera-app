<script lang="ts">
	import Menu from '$lib/zag/Menu.svelte';
	import { Zap, Layers, ArrowUpDown, BarChart2, ChevronUp, ChevronDown } from '@lucide/svelte';
	import { fetchPools, type TimeRange } from './poolsData';
	import type { PoolRow } from './poolsData';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import AddLiquidityPopup from './AddLiquidityPopup.svelte';
	import RemoveLiquidityPopup from './RemoveLiquidityPopup.svelte';
	import PoolDetail from './PoolDetail.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';

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
	let createPoolOpen = $state(false);
	let createPoolToggle = $state<(open?: boolean) => void>(() => {});

	let pools = $state<PoolRow[]>([]);
	let loading = $state(false);
	let selectedPool = $state<PoolRow | null>(null);

	$effect(() => {
		const range = timeRange;
		loading = true;
		fetchPools(range).then((result) => {
			pools = result;
			loading = false;
		});
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

	const menuItems = [
		{ label: 'Create Pool' },
		{ label: 'Add liquidity' },
		{ label: 'Remove liquidity' }
	];

	function handleMenuSelect(e: { value: string }) {
		if (e.value === 'Create Pool') createPoolToggle(true);
		if (e.value === 'Add liquidity') addLiquidityOpen = true;
		if (e.value === 'Remove liquidity') removeLiquidityOpen = true;
	}
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
				{#each sortedPools as pool (pool.id)}
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

	<div class="fab-wrapper">
		<Menu
			label="Pool actions"
			styleType="icon"
			items={menuItems}
			onSelect={handleMenuSelect}
		>
			{#snippet children()}
				<Zap size={24} aria-hidden="true" />
			{/snippet}
		</Menu>
	</div>
</div>

<AddLiquidityPopup bind:open={addLiquidityOpen} {pools} />
<RemoveLiquidityPopup bind:open={removeLiquidityOpen} {pools} />

<Dialog bind:open={createPoolOpen} bind:toggle={createPoolToggle}>
	{#snippet title()}
		Create Pool
	{/snippet}
	{#snippet content()}
		<p class="placeholder-text">Create pool form will go here.</p>
	{/snippet}
</Dialog>
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
		color: var(--neutral-fg);
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		min-width: 10rem;
		&::placeholder {
			color: var(--neutral-fg-mid);
		}
		&:focus {
			outline: 2px solid var(--primary-fg-mid);
			outline-offset: 2px;
		}
	}

	.time-filters {
		display: flex;
		gap: 0.25rem;
	}

	.time-btn {
		font: inherit;
		color: var(--neutral-fg);
		background-color: var(--neutral-bg-accent);
		border: 1px solid transparent;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		transition: background-color 0.1s, color 0.1s;
		&:hover {
			background-color: var(--neutral-bg-accent-shifted);
			color: var(--primary-fg-accent);
		}
		&.active {
			background-color: var(--primary-bg-mid);
			color: var(--primary-fg-accent);
		}
	}

	.table-wrapper {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border: 1px solid var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem;
		background-color: var(--neutral-off-bg);
	}

	.pools-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	.pools-table th,
	.pools-table td {
		text-align: left;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--neutral-bg-accent);
		vertical-align: top;
	}

	.pools-table th {
		color: var(--neutral-fg-mid);
		font-weight: 500;
		white-space: nowrap;
	}

	.pools-table tbody tr:hover {
		background-color: var(--neutral-bg-accent);
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
		color: var(--neutral-fg-mid);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		white-space: nowrap;
		&:hover {
			color: var(--primary-fg-accent);
		}
	}

	.pools-table th.sortable.active .col-heading-btn {
		color: var(--primary-fg-accent);
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
		border: 2px solid var(--neutral-bg);
		margin-left: -0.35rem;
	}
	.pair-icons .icon {
		background-color: var(--primary-bg-mid);
	}
	.pair-icons .icon:first-child,
	.pair-icons .coin-icon:first-child {
		margin-left: 0;
	}
	.pair-icons .icon-b:not(.coin-icon) {
		background-color: var(--primary-bg-accent);
	}

	.pair-label {
		font-weight: 500;
		color: var(--neutral-fg);
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
		color: var(--neutral-fg-mid);
		font-size: var(--text-xs);
	}

	.price-usd {
		font-size: var(--text-xs);
		color: var(--neutral-fg-mid);
		margin-top: 0.35rem;
	}

	.amount-cell .total {
		color: var(--neutral-fg);
		font-weight: 500;
	}

	.fab-wrapper {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		z-index: 8;
	}

	.fab-wrapper :global(button) {
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		padding: 0;
		box-shadow: 0 4px 12px oklch(from var(--neutral-fg) l c h / 0.2);
		background-color: var(--primary-bg-mid) !important;
		color: var(--primary-fg-accent) !important;
	}
	.fab-wrapper :global(button:hover) {
		background-color: var(--primary-bg-accent) !important;
		color: var(--primary-fg) !important;
	}

	.placeholder-text {
		color: var(--neutral-fg-mid);
		padding: 0.5rem 0;
	}
</style>
