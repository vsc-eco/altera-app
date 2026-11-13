<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from './Card.svelte';
	import DatePicker, { type DateRange } from './Balance/Date.svelte';
	import { buildDateRanges, dateGrid, intervalFor, isHourly } from './Balance/dateRanges';
	import MultiSeriesChart, {
		type ChartSeries
	} from '$lib/components/charts/MultiSeriesChart.svelte';
	import { fetchPools } from '$lib/pools/poolsData';
	import {
		fetchUserPoolRevenue,
		type PoolRevenueHistory
	} from '$lib/indexer/poolRevenueQueries';
	import { numberFormatLanguage } from '$lib/constants';
	import { Table2, ChartLine } from '@lucide/svelte';
	import moment from 'moment';

	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);

	const dateRanges = buildDateRanges();
	let selectedDateRange: DateRange = $state(dateRanges[1]); // Last 30 Days
	let interval = $derived(intervalFor(selectedDateRange));
	let dates = $derived(dateGrid(selectedDateRange, interval));

	let revenue: PoolRevenueHistory = $state({ pools: [], skippedLegacyRows: false });
	/** Colour slot per pool contract, taken from the registry's own order so a
	 *  pool keeps its colour no matter how the user's rows rank or filter. */
	let slotByPool = $state<Record<string, string>>({});
	let loading = $state(true);
	/** Undefined until the first load settles: the card must not flash in and
	 *  back out for the (many) users who have never provided liquidity. */
	let hasPositions: boolean | undefined = $state(undefined);
	let view: 'chart' | 'table' = $state('chart');

	const SLOTS = [
		'var(--viz-1)',
		'var(--viz-2)',
		'var(--viz-3)',
		'var(--viz-4)',
		'var(--viz-5)',
		'var(--viz-6)'
	];
	const OTHER = 'var(--viz-other)';

	const total = $derived(
		revenue.pools.reduce((sum, p) => sum + (p.cumulativeUsd[dates.length - 1] ?? 0), 0)
	);

	/** One formatting style for the whole axis: LP fees on a small position run
	 *  to fractions of a cent, so the scale picks its precision from the data. */
	const decimals = $derived(total > 0 && total < 1 ? 4 : 2);
	const usd = (v: number) =>
		`$${v.toLocaleString(numberFormatLanguage, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		})}`;

	function nativeDetail(poolIndex: number, i: number): string | undefined {
		const pool = revenue.pools[poolIndex];
		if (!pool) return undefined;
		const parts = Object.entries(pool.byAssetAt)
			.filter(([, amounts]) => (amounts[i] ?? 0) > 0)
			.map(
				([asset, amounts]) =>
					`${amounts[i].toLocaleString(numberFormatLanguage, {
						maximumSignificantDigits: 6
					})} ${asset.toUpperCase()}`
			);
		return parts.length > 0 ? parts.join(' + ') : undefined;
	}

	const chartSeries = $derived<ChartSeries[]>(
		revenue.pools.map((p, idx) => ({
			key: p.contractId,
			label: p.pair,
			color: slotByPool[p.contractId] ?? OTHER,
			values: p.cumulativeUsd,
			detail: dates.map((_, i) => nativeDetail(idx, i) ?? '')
		}))
	);

	$effect(() => {
		const account = did;
		const grid = dates;
		if (!account) {
			revenue = { pools: [], skippedLegacyRows: false };
			hasPositions = false;
			loading = false;
			return;
		}
		let cancelled = false;
		loading = true;
		(async () => {
			const pools = await fetchPools('30d');
			// Registry order (sorted by contract id) fixes the colour slots.
			const ordered = [...pools].map((p) => p.contractId).sort();
			const slots: Record<string, string> = {};
			ordered.forEach((id, i) => {
				slots[id] = i < SLOTS.length ? SLOTS[i] : OTHER;
			});
			const result = await fetchUserPoolRevenue(account, pools, grid);
			if (cancelled) return;
			slotByPool = slots;
			revenue = result;
			hasPositions = result.pools.length > 0;
		})()
			.catch((err) => {
				console.error('Failed to load pool revenue history', err);
				if (!cancelled) {
					revenue = { pools: [], skippedLegacyRows: false };
					hasPositions = false;
				}
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if hasPositions !== false}
	<Card>
		<div class="root">
			<div class="header-row">
				<div class="title-area">
					<h5>Pool revenue</h5>
					<span class="total">{usd(total)}</span>
				</div>
				<div class="controls">
					<button
						class="view-toggle"
						onclick={() => (view = view === 'chart' ? 'table' : 'chart')}
						aria-pressed={view === 'table'}
						title={view === 'chart' ? 'Show the values as a table' : 'Show the chart'}
					>
						{#if view === 'chart'}
							<Table2 size={14} /> Table
						{:else}
							<ChartLine size={14} /> Chart
						{/if}
					</button>
					<div class="date-select">
						<DatePicker
							onValueChange={(v) => (selectedDateRange = v)}
							{dateRanges}
							hourly={isHourly(selectedDateRange)}
						></DatePicker>
					</div>
				</div>
			</div>

			{#if view === 'chart'}
				<MultiSeriesChart
					{dates}
					series={chartSeries}
					height={240}
					mode="stacked"
					isLoading={loading}
					formatValue={usd}
					emptyLabel="No pool fees earned yet"
				/>
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								{#each revenue.pools as p (p.contractId)}
									<th class="num">{p.pair}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each dates as d, i (d.getTime())}
								<tr>
									<td>
										{moment(d).format(isHourly(selectedDateRange) ? 'MMM D, HH:mm' : 'MMM D, YYYY')}
									</td>
									{#each revenue.pools as p, idx (p.contractId)}
										<td class="num">
											<span class="cell-usd-strong">{usd(p.cumulativeUsd[i] ?? 0)}</span>
											{#if nativeDetail(idx, i)}
												<span class="cell-native">{nativeDetail(idx, i)}</span>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<p class="footnote">
				Your share of the LP fees each pool charged while you held liquidity. Magi leaves LP fees in
				the pool, so this is value added to your position, not a claimable balance — it keeps
				counting from your first deposit, so the date range only zooms.{#if revenue.skippedLegacyRows}
					{' '}Fees from before the pendulum fee layout record no asset and are excluded, as on the
					Pools table.{/if}
			</p>
		</div>
	</Card>
{/if}

<style lang="scss">
	.root {
		display: flex;
		flex-direction: column;
		min-width: min(280px, 100%);
		flex: 1;
		gap: 0.25rem;
	}
	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		min-height: 2rem;
		margin-bottom: 0.4rem;
	}
	h5 {
		color: var(--dash-text-primary);
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0 !important;
	}
	.title-area {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.total {
		font-size: 1rem;
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.view-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: none;
		border: 1px solid var(--dash-card-border);
		border-radius: 0.375rem;
		color: var(--dash-text-secondary);
		font: inherit;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}
	.view-toggle:hover {
		color: var(--dash-text-primary);
		border-color: var(--dash-card-border-highlight);
	}
	.table-wrap {
		max-height: 260px;
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-xs);
	}
	th {
		position: sticky;
		top: 0;
		background: var(--dash-bg);
		text-align: left;
		color: var(--dash-text-secondary);
		font-weight: 600;
		padding: 0.3rem 0.5rem;
	}
	td {
		padding: 0.25rem 0.5rem;
		color: var(--dash-text-secondary);
		border-top: 1px solid var(--dash-chart-grid);
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.cell-usd-strong {
		display: block;
		color: var(--dash-text-primary);
	}
	.cell-native {
		display: block;
		color: var(--dash-text-muted);
	}
	.footnote {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		margin: 0.35rem 0 0;
	}

	@media (max-width: 600px) {
		.header-row {
			flex-direction: column;
			align-items: flex-start;
		}
		.controls {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
