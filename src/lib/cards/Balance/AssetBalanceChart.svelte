<script lang="ts">
	import LineChart, { type ChartSeries, type Point } from '$lib/LineChart.svelte';
	import DatePicker, { type DateRange } from './Date.svelte';
	import { buildDateRanges, intervalFor, isHourly } from './dateRanges';
	import {
		fetchAssetBalanceHistory,
		type AssetBalanceHistory,
		type AssetKey
	} from '$lib/stores/assetBalanceHistory';
	import { numberFormatLanguage } from '$lib/constants';
	import { compactUsd } from '$lib/currency/compactUsd';

	let { did }: { did: string | undefined } = $props();

	const dateRanges = buildDateRanges();
	let selectedDateRange: DateRange = $state(dateRanges[1]); // Last 30 Days
	let interval = $derived(intervalFor(selectedDateRange));

	let history: AssetBalanceHistory = $state({ dates: [], series: [], pricesOk: true });
	let loading = $state(true);
	let hoveredPoint = $state<Point | undefined>();
	let hoveredIndex = $state<number | undefined>();

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

	/** LineChart reads only `date` from this in multi-series mode. */
	const timeline = $derived<Point[]>(history.dates.map((date) => ({ date, value: 0 })));

	const chartSeries = $derived<ChartSeries[]>(
		history.series.map((s) => ({
			key: s.key,
			label: s.label,
			color: COLOR[s.key],
			values: s.usd,
			detail: s.amounts.map((a) => native(a, s.decimals, s.unit))
		}))
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

<div class="asset-chart">
	<div class="head">
		<span class="caption">
			{#if hoveredPoint}
				{new Intl.DateTimeFormat(numberFormatLanguage, {
					month: 'short',
					day: 'numeric',
					...(isHourly(selectedDateRange) ? { hour: '2-digit', minute: '2-digit' } : {})
				}).format(hoveredPoint.date)}
			{:else}
				Balance per asset
			{/if}
		</span>
		<div class="date-select">
			<DatePicker
				onValueChange={(v) => (selectedDateRange = v)}
				{dateRanges}
				hourly={isHourly(selectedDateRange)}
			></DatePicker>
		</div>
	</div>

	<div class="chart">
		<LineChart
			data={timeline}
			series={chartSeries}
			height={200}
			isLoading={loading}
			formatValue={usd}
			formatTick={compactUsd}
			emptyLabel={history.pricesOk
				? 'No balance in this period'
				: 'Price data unavailable — USD values cannot be shown'}
			bind:hoveredPoint
			bind:hoveredIndex
		/>
	</div>

	<p class="footnote">
		Valued at today's price, so the curve tracks your balance moving, not the market. Hover for the
		amount in each asset's own unit.
	</p>
</div>

<style lang="scss">
	.asset-chart {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding-top: 0.25rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}
	.caption {
		color: var(--dash-text-secondary);
		font-size: var(--text-xs);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chart {
		min-width: 0;
		--fg-mid: var(--dash-chart-line);
		--bg-accent: var(--dash-chart-line);
		--bg: transparent;
	}
	.footnote {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		margin: 0.5rem 0 0;
	}
</style>
