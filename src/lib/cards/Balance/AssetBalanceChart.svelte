<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '../Card.svelte';
	import DatePicker, { type DateRange } from './Date.svelte';
	import { buildDateRanges, intervalFor, isHourly } from './dateRanges';
	import MultiSeriesChart, {
		type ChartSeries
	} from '$lib/components/charts/MultiSeriesChart.svelte';
	import {
		fetchAssetBalanceHistory,
		type AssetBalanceHistory,
		type AssetKey
	} from '$lib/stores/assetBalanceHistory';
	import { numberFormatLanguage } from '$lib/constants';
	import { Table2, ChartLine } from '@lucide/svelte';
	import moment from 'moment';

	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);

	const dateRanges = buildDateRanges();
	let selectedDateRange: DateRange = $state(dateRanges[1]); // Last 30 Days
	let interval = $derived(intervalFor(selectedDateRange));

	let history: AssetBalanceHistory = $state({ dates: [], series: [], pricesOk: true });
	let loading = $state(true);
	let view: 'chart' | 'table' = $state('chart');

	/** Colour slot per asset, fixed for the lifetime of the chart. Hiding a
	 *  flat-zero asset never repaints the ones that remain. */
	const COLOR: Record<AssetKey, string> = {
		hbd: 'var(--viz-1)',
		btc: 'var(--viz-2)',
		hive: 'var(--viz-3)'
	};

	const usd = (v: number) =>
		`$${v.toLocaleString(numberFormatLanguage, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		})}`;

	function native(amount: number, decimals: number, unit: string): string {
		return `${amount.toLocaleString(numberFormatLanguage, {
			minimumFractionDigits: Math.min(decimals, 3),
			maximumFractionDigits: decimals
		})} ${unit}`;
	}

	const chartSeries = $derived<ChartSeries[]>(
		history.series.map((s) => ({
			key: s.key,
			label: s.label,
			color: COLOR[s.key],
			values: s.usd,
			detail: s.amounts.map((a) => native(a, s.decimals, s.unit))
		}))
	);

	/** Assets with any balance in the window — what the table shows, matching
	 *  the series the chart draws. */
	const held = $derived(history.series.filter((s) => s.amounts.some((a) => Math.abs(a) > 0)));

	const total = $derived(
		history.dates.length > 0
			? history.series.reduce((sum, s) => sum + (s.usd[s.usd.length - 1] ?? 0), 0)
			: 0
	);

	$effect(() => {
		const account = did;
		const range = selectedDateRange;
		const step = interval;
		if (!account) {
			history = { dates: [], series: [], pricesOk: true };
			loading = false;
			return;
		}
		let cancelled = false;
		loading = true;
		fetchAssetBalanceHistory(account, range.start, range.end, step)
			.then((h) => {
				if (!cancelled) history = h;
			})
			.catch((err) => {
				console.error('Failed to load the per-asset balance history', err);
				if (!cancelled) history = { dates: [], series: [], pricesOk: true };
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});
		return () => {
			cancelled = true;
		};
	});
</script>

<Card>
	<div class="root">
		<div class="header-row">
			<div class="title-area">
				<h5>Balance by asset</h5>
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
				dates={history.dates}
				series={chartSeries}
				height={240}
				isLoading={loading}
				formatValue={usd}
				emptyLabel={history.pricesOk
					? 'No balance in this period'
					: 'Price data unavailable — USD values cannot be shown'}
			/>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Date</th>
							{#each held as s (s.key)}
								<th class="num">{s.label}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each history.dates as d, i (d.getTime())}
							<tr>
								<td>
									{moment(d).format(isHourly(selectedDateRange) ? 'MMM D, HH:mm' : 'MMM D, YYYY')}
								</td>
								{#each held as s (s.key)}
									<td class="num">
										<span class="cell-native">{native(s.amounts[i] ?? 0, s.decimals, s.unit)}</span>
										<span class="cell-usd">{usd(s.usd[i] ?? 0)}</span>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
				{#if history.dates.length === 0 && !loading}
					<p class="empty">No balance in this period</p>
				{/if}
			</div>
		{/if}

		<p class="footnote">
			Each asset's balance valued at today's price, so the curve tracks your balance moving — not
			the market. Hover a point for the amount in its own unit.
		</p>
	</div>
</Card>

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
	.cell-native {
		display: block;
		color: var(--dash-text-primary);
	}
	.cell-usd {
		display: block;
		color: var(--dash-text-muted);
	}
	.empty {
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
		text-align: center;
		padding: 1.5rem 0;
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
