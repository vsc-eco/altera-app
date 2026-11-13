<script lang="ts" module>
	/** One plotted series. `values` is index-aligned with the chart's `dates`. */
	export type ChartSeries = {
		/** Stable identity — picks the colour slot, never the row order. */
		key: string;
		label: string;
		/** CSS colour (a `--viz-*` token), fixed per entity. */
		color: string;
		values: number[];
		/** Optional per-point secondary readout for the tooltip (e.g. "12.345 HIVE"). */
		detail?: string[];
	};
</script>

<script lang="ts">
	import { scaleLinear, scaleTime } from 'd3-scale';
	import { area, line, curveMonotoneX } from 'd3-shape';
	import { extent } from 'd3-array';
	import moment from 'moment';
	import WaveLoading from '../WaveLoading.svelte';

	type Props = {
		dates: Date[];
		series: ChartSeries[];
		height?: number;
		/** `line` overlays each series; `stacked` stacks them into a part-to-whole band chart. */
		mode?: 'line' | 'stacked';
		isLoading?: boolean;
		/** Formats a y value for axis ticks, legend and tooltip. */
		formatValue?: (v: number) => string;
		/** Shown under the legend when every series is flat zero. */
		emptyLabel?: string;
	};

	let {
		dates,
		series,
		height = 260,
		mode = 'line',
		isLoading = false,
		formatValue = (v: number) => `$${v.toFixed(2)}`,
		emptyLabel = 'No activity in this period'
	}: Props = $props();

	let width = $state(0);
	let hoveredIndex: number | undefined = $state();

	const margin = { top: 10, right: 12, bottom: 0, left: 52 };

	/** Series the reader can act on: drop the ones that are flat zero across
	 *  the whole window so a user holding two assets doesn't read five lines. */
	const shown = $derived(series.filter((s) => s.values.some((v) => Math.abs(v) > 1e-9)));
	const isEmpty = $derived(shown.length === 0);

	/** Cumulative tops per index, in stack order, so a band's lower edge is
	 *  the previous band's upper edge. */
	const stacked = $derived.by(() => {
		const tops: number[][] = [];
		const running = new Array(dates.length).fill(0);
		for (const s of shown) {
			const top = dates.map((_, i) => (running[i] += Math.max(0, s.values[i] ?? 0)));
			tops.push(top);
		}
		return tops;
	});

	const dateExtent = $derived(
		dates.length > 0 ? (extent(dates) as [Date, Date]) : [new Date(), new Date()]
	);
	const xScale = $derived(
		scaleTime()
			.domain(dateExtent)
			.range([margin.left, Math.max(margin.left + 1, width - margin.right)])
	);

	const maxValue = $derived.by(() => {
		if (mode === 'stacked') {
			const last = stacked[stacked.length - 1];
			return last ? Math.max(...last, 0) : 0;
		}
		let m = 0;
		for (const s of shown) for (const v of s.values) if (v > m) m = v;
		return m;
	});

	const yScale = $derived(
		scaleLinear()
			.domain([0, maxValue > 0 ? maxValue : 1])
			.nice()
			.range([height - margin.bottom, margin.top])
	);
	const yTicks = $derived(yScale.ticks(4));

	const lineGen = $derived(
		line<number>()
			.x((_, i) => xScale(dates[i]))
			.y((v) => yScale(v))
			.curve(curveMonotoneX)
	);
	const bandGen = $derived(
		area<number>()
			.x((_, i) => xScale(dates[i]))
			.y1((v) => yScale(v))
			.curve(curveMonotoneX)
	);

	function bandPath(idx: number): string | null {
		const top = stacked[idx];
		if (!top) return null;
		const below = idx === 0 ? dates.map(() => 0) : stacked[idx - 1];
		return bandGen.y0((_, i) => yScale(below[i]))(top);
	}

	/** Date labels along the x axis, spaced so they never collide. */
	const xLabels = $derived.by(() => {
		if (dates.length === 0 || width === 0) return [] as Date[];
		const count = Math.max(2, Math.min(6, Math.floor((width - margin.left) / 86)));
		if (dates.length <= count) return dates;
		const step = (dates.length - 1) / (count - 1);
		return Array.from({ length: count }, (_, i) => dates[Math.round(i * step)]);
	});
	const spanDays = $derived(moment(dateExtent[1]).diff(moment(dateExtent[0]), 'days'));
	const xLabelFormat = $derived(spanDays <= 2 ? 'MMM D · HH:mm' : 'MMM D');

	/** Endpoint value per shown series, for the legend and the direct labels. */
	const endValue = $derived(
		shown.map((s, idx) =>
			mode === 'stacked'
				? (stacked[idx]?.[dates.length - 1] ?? 0)
				: (s.values[dates.length - 1] ?? 0)
		)
	);
	const legendValue = $derived(
		shown.map((s) => s.values[hoveredIndex ?? dates.length - 1] ?? 0)
	);

	/** Direct end labels only while they stay ≥ 14px apart — nudged labels
	 *  detach from their lines, so converging series fall back to the legend. */
	const endLabels = $derived.by(() => {
		if (shown.length === 0 || shown.length > 4 || dates.length === 0) return [];
		const ys = endValue.map((v) => yScale(v));
		const sorted = [...ys].sort((a, b) => a - b);
		for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] < 14) return [];
		return shown.map((s, i) => ({ color: s.color, y: ys[i], text: formatValue(endValue[i]) }));
	});

	function indexFromPointer(e: PointerEvent | MouseEvent) {
		if (dates.length === 0) return;
		const bb = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const usable = Math.max(1, bb.width - margin.left - margin.right);
		const frac = (e.clientX - bb.left - margin.left) / usable;
		const i = Math.round(frac * (dates.length - 1));
		hoveredIndex = Math.min(dates.length - 1, Math.max(0, i));
	}
	function onKey(e: KeyboardEvent) {
		if (dates.length === 0) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			const cur = hoveredIndex ?? dates.length - 1;
			hoveredIndex = Math.min(dates.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
		} else if (e.key === 'Escape') {
			hoveredIndex = undefined;
		}
	}

	const crosshairX = $derived(hoveredIndex == undefined ? 0 : xScale(dates[hoveredIndex]));
	/** Keep the readout inside the plot: flip it left of the crosshair once
	 *  the pointer passes the two-thirds mark. */
	const tipFlipped = $derived(crosshairX > margin.left + (width - margin.left) * 0.62);
</script>

<figure class={{ zero: width == 0 }} bind:clientWidth={width}>
	{#if isLoading}
		<div class="overlay"><WaveLoading /><span>Loading chart data…</span></div>
	{:else if isEmpty}
		<div class="overlay"><span>{emptyLabel}</span></div>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="plot"
		class:dim={isLoading}
		style:height="{height}px"
		role="img"
		tabindex="0"
		aria-label="Chart with {shown.length} series. Use the arrow keys to read values."
		onpointermove={indexFromPointer}
		onpointerdown={indexFromPointer}
		onpointerleave={() => (hoveredIndex = undefined)}
		onkeydown={onKey}
		onblur={() => (hoveredIndex = undefined)}
	>
		<svg {height} width="100%" aria-hidden="true">
			{#each yTicks as t}
				<line
					class="grid"
					x1={margin.left}
					x2={width - margin.right}
					y1={yScale(t)}
					y2={yScale(t)}
				></line>
				<text class="tick" x={margin.left - 8} y={yScale(t)} text-anchor="end">
					{formatValue(t)}
				</text>
			{/each}

			{#if mode === 'stacked'}
				{#each shown as s, i (s.key)}
					<path class="band" d={bandPath(i)} fill={s.color} />
				{/each}
			{:else}
				{#each shown as s (s.key)}
					<path class="wash" d={bandGen.y0(() => yScale(0))(s.values)} fill={s.color} />
				{/each}
				{#each shown as s (s.key)}
					<path class="line" d={lineGen(s.values)} stroke={s.color} />
				{/each}
			{/if}

			{#if hoveredIndex != undefined}
				<line
					class="crosshair"
					x1={crosshairX}
					x2={crosshairX}
					y1={margin.top}
					y2={height - margin.bottom}
				></line>
				{#each shown as s, i (s.key)}
					{@const v =
						mode === 'stacked'
							? (stacked[i]?.[hoveredIndex] ?? 0)
							: (s.values[hoveredIndex] ?? 0)}
					<circle class="dot" cx={crosshairX} cy={yScale(v)} r="4" fill={s.color} />
				{/each}
			{/if}

			{#each endLabels as l}
				<text class="end-label" x={width - margin.right} y={l.y - 7} text-anchor="end">
					{l.text}
				</text>
			{/each}
		</svg>

		{#if hoveredIndex != undefined && !isEmpty}
			<div
				class="tooltip"
				class:flipped={tipFlipped}
				style:--x="{crosshairX}px"
				role="status"
				aria-live="polite"
			>
				<span class="tip-date">
					{moment(dates[hoveredIndex]).format(spanDays <= 2 ? 'MMM D, HH:mm' : 'MMM D, YYYY')}
				</span>
				{#each shown as s, i (s.key)}
					<span class="tip-row">
						<span class="key-line" style:background={s.color}></span>
						<span class="tip-value">{formatValue(s.values[hoveredIndex] ?? 0)}</span>
						<span class="tip-label">{s.label}</span>
					</span>
					{#if s.detail?.[hoveredIndex]}
						<span class="tip-detail">{s.detail[hoveredIndex]}</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<div class="x-axis">
		{#each xLabels as d}
			<span class="x-label" style:--position="{xScale(d)}px">{moment(d).format(xLabelFormat)}</span>
		{/each}
	</div>

	{#if shown.length >= 1}
		<ul class="legend">
			{#each shown as s, i (s.key)}
				<li>
					<span class="swatch" style:background={s.color}></span>
					<span class="legend-label">{s.label}</span>
					<span class="legend-value">{formatValue(legendValue[i])}</span>
				</li>
			{/each}
		</ul>
	{/if}
</figure>

<style lang="scss">
	figure {
		position: relative;
		margin: 0;
		min-width: 0;
	}
	.zero {
		opacity: 0;
	}
	.plot {
		position: relative;
		touch-action: pinch-zoom pan-y;
		outline: none;
	}
	.plot:focus-visible {
		outline: 1px solid var(--dash-text-accent);
		outline-offset: 2px;
		border-radius: 8px;
	}
	.dim {
		opacity: 0.55;
		filter: grayscale(0.4);
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--dash-chart-grid);
		stroke-width: 1;
	}
	.tick,
	.end-label {
		fill: var(--dash-text-muted);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.tick {
		dominant-baseline: middle;
	}
	.end-label {
		fill: var(--dash-text-secondary);
	}
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.wash {
		opacity: 0.1;
	}
	/* Part-to-whole bands: the 2px separation is drawn in the surface colour,
	   never as a border in the series colour. */
	.band {
		opacity: 0.72;
		stroke: var(--dash-card-bg-solid, #16161f);
		stroke-width: 2;
	}
	:global(.light-theme) .band {
		stroke: #ffffff;
	}
	@media (prefers-color-scheme: light) {
		:global(:root:not(.light-theme):not(.dark-theme)) .band {
			stroke: #ffffff;
		}
	}
	.crosshair {
		stroke: var(--dash-text-muted);
		stroke-width: 1;
	}
	.dot {
		stroke: var(--dash-bg);
		stroke-width: 2;
	}
	.x-axis {
		position: relative;
		height: calc(var(--text-xs) + 0.65rem);
	}
	.x-label {
		position: absolute;
		left: var(--position);
		top: 50%;
		transform: translate(-50%, -50%);
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		white-space: nowrap;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1.1rem;
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--text-xs);
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.legend-label {
		color: var(--dash-text-secondary);
	}
	.legend-value {
		color: var(--dash-text-primary);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.tooltip {
		position: absolute;
		left: var(--x);
		top: 0;
		transform: translateX(12px);
		pointer-events: none;
		display: grid;
		gap: 0.15rem;
		padding: 0.5rem 0.65rem;
		border-radius: 10px;
		background: var(--dash-bg);
		border: 1px solid var(--dash-card-border);
		box-shadow: var(--dash-card-shadow);
		white-space: nowrap;
		z-index: 4;
	}
	.tooltip.flipped {
		transform: translateX(calc(-100% - 12px));
	}
	.tip-date {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
	}
	.tip-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: var(--text-xs);
	}
	.key-line {
		width: 12px;
		height: 2px;
		border-radius: 1px;
		align-self: center;
		flex-shrink: 0;
	}
	.tip-value {
		color: var(--dash-text-primary);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.tip-label {
		color: var(--dash-text-secondary);
	}
	.tip-detail {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		padding-left: 1rem;
	}
	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		z-index: 3;
		font-size: var(--text-sm);
		color: var(--dash-text-muted);
	}
</style>
