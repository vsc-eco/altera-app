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
	import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from '@lucide/svelte';
	import {
		MIN_POINTS,
		panWindow,
		resolveWindow,
		zoomWindow,
		type ChartWindow
	} from './chartWindow';

	let {
		did,
		/** Plot height in px. The default is the dashboard card's size; the
		 *  pop-out passes the room it actually has. */
		height = 200,
		/** Show the zoom / pan controls. Off by default: they are worth the
		 *  row they cost in the pop-out, not in a 200px card. */
		zoomable = false
	}: { did: string | undefined; height?: number; zoomable?: boolean } = $props();

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

	/** The visible slice of what has been fetched. See `chartWindow.ts`. */
	let win = $state<ChartWindow>(null);
	const pointCount = $derived(history.dates.length);
	const view = $derived(resolveWindow(win, pointCount));
	const zoomed = $derived(win !== null);

	$effect(() => {
		// Reading `history` is the point: any new data drops the window.
		history;
		win = null;
	});

	const zoomBy = (factor: number) => (win = zoomWindow(win, factor, pointCount));
	const panBy = (fraction: number) => (win = panWindow(win, fraction, pointCount));

	const canZoomIn = $derived(view.e - view.s > MIN_POINTS);
	const canPanLeft = $derived(zoomed && view.s > 0);
	const canPanRight = $derived(zoomed && view.e < pointCount);

	const visibleDates = $derived(history.dates.slice(view.s, view.e));

	/** LineChart reads only `date` from this in multi-series mode. */
	const timeline = $derived<Point[]>(visibleDates.map((date) => ({ date, value: 0 })));

	const chartSeries = $derived<ChartSeries[]>(
		history.series.map((s) => ({
			key: s.key,
			label: s.label,
			color: COLOR[s.key],
			values: s.usd.slice(view.s, view.e),
			detail: s.amounts.slice(view.s, view.e).map((a) => native(a, s.decimals, s.unit))
		}))
	);

	const dayFormat = new Intl.DateTimeFormat(numberFormatLanguage, {
		month: 'short',
		day: 'numeric'
	});
	/** What the window currently covers, so zooming says where it landed. */
	const windowLabel = $derived(
		visibleDates.length > 0
			? `${dayFormat.format(visibleDates[0])} – ${dayFormat.format(visibleDates[visibleDates.length - 1])}`
			: ''
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
			{:else if zoomable && zoomed}
				{windowLabel}
			{:else}
				Balance per asset
			{/if}
		</span>
		{#if zoomable}
			<div class="zoom-controls" role="group" aria-label="Zoom and move the chart">
				<button
					type="button"
					onclick={() => panBy(-0.5)}
					disabled={!canPanLeft}
					title="Move back"
					aria-label="Move back"
				>
					<ChevronLeft size={15} aria-hidden="true" />
				</button>
				<button
					type="button"
					onclick={() => zoomBy(1 / 0.6)}
					disabled={!zoomed}
					title="Zoom out"
					aria-label="Zoom out"
				>
					<ZoomOut size={15} aria-hidden="true" />
				</button>
				<button
					type="button"
					onclick={() => zoomBy(0.6)}
					disabled={!canZoomIn}
					title="Zoom in"
					aria-label="Zoom in"
				>
					<ZoomIn size={15} aria-hidden="true" />
				</button>
				<button
					type="button"
					onclick={() => panBy(0.5)}
					disabled={!canPanRight}
					title="Move forward"
					aria-label="Move forward"
				>
					<ChevronRight size={15} aria-hidden="true" />
				</button>
				<button
					type="button"
					onclick={() => (win = null)}
					disabled={!zoomed}
					title="Show the whole range"
					aria-label="Show the whole range"
				>
					<RotateCcw size={14} aria-hidden="true" />
				</button>
			</div>
		{/if}
		<div class="date-select">
			<DatePicker
				onValueChange={(v) => (selectedDateRange = v)}
				{dateRanges}
				selected={selectedDateRange}
				hourly={isHourly(selectedDateRange)}
			></DatePicker>
		</div>
	</div>

	<div class="chart">
		<LineChart
			data={timeline}
			series={chartSeries}
			{height}
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
	/* One segmented cluster, so it reads as a single control rather than five
	   loose buttons. Sits between the caption and the range dropdown: the
	   dropdown chooses what is loaded, these choose what is shown of it. */
	.zoom-controls {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
		padding: 2px;
		border-radius: 999px;
		background: var(--alt-field, rgba(0, 0, 0, 0.3));
		border: 1px solid var(--alt-field-border, rgba(255, 255, 255, 0.06));
	}
	.zoom-controls button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--alt-tx-2, var(--dash-text-secondary));
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}
	.zoom-controls button:hover:not(:disabled) {
		background: var(--alt-chip-hover, rgba(255, 255, 255, 0.12));
		color: var(--alt-tx, var(--dash-text-primary));
	}
	.zoom-controls button:disabled {
		opacity: 0.35;
		cursor: default;
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
