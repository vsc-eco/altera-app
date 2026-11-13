<script lang="ts" module>
	export type Point = {
		value: number;
		date: Date;
	};

	/**
	 * One extra series plotted over the same dates as `data`.
	 *
	 * `values` is index-aligned with `data`, and `key` is the series' identity:
	 * it picks the colour and never changes with row order, so hiding a series
	 * can't repaint the ones that remain.
	 */
	export type ChartSeries = {
		key: string;
		label: string;
		/** CSS colour — a `--viz-*` token. */
		color: string;
		values: number[];
		/** Optional per-point secondary readout for the tooltip. */
		detail?: string[];
	};

	/** Gradient ids have to be unique per instance: two charts on one page
	 *  sharing `url(#MyGradient)` would both resolve to whichever rendered
	 *  first. */
	let gradientSeq = 0;
</script>

<script lang="ts">
	// TODO: Handle case where data points are not evenly spaced out in time
	// What breaks:
	// - the linear interp in the afterUpdate listener over toIdx since
	//   if values are not evenly spaced over x then the interp should vary
	//   from index gap to index gap.
	// - the mapping from mouse position to hoveredIndex
	import type { ScaleLinear } from 'd3-scale';
	import { scaleLinear, scaleTime } from 'd3-scale';
	import { extent, max } from 'd3-array';
	import { area, curveMonotoneX } from 'd3-shape';
	import {
		changeLocalInterpFunction,
		createAnimation,
		getLinearInterp,
		getSlerp,
		getStateTree,
		lerpFunc,
		modifyTo,
		NO_INTERP
	} from 'aninest';
	import { getUpdateLayer } from '@aninest/extensions';
	import moment from 'moment';
	import WaveLoading from './components/WaveLoading.svelte';
	import { pointerIndex } from './chartPointer';
	import { untrack } from 'svelte';

	type Props = {
		hoveredPoint?: Point;
		hoveredIndex?: number;
		height?: number;
		/** The timeline. In multi-series mode only `date` is read. */
		data: Point[];
		theme?: string;
		isLoading?: boolean;
		styleType?: 'balance' | 'trend';
		showYAxis?: boolean;
		/** Supplying this switches the chart to multi-series mode. */
		series?: ChartSeries[];
		/** `line` overlays the series; `stacked` stacks them part-to-whole. */
		mode?: 'line' | 'stacked';
		/** Formats y values for the legend and tooltip (multi-series only). */
		formatValue?: (v: number) => string;
		/** Formats an axis tick. Ticks sit in a fixed gutter, so this wants a
		 *  COMPACT form ("$1.2K"), not the full one the tooltip shows. */
		formatTick?: (v: number) => string;
		/** Shown when every series is flat zero. */
		emptyLabel?: string;
	};
	let width = $state(0);
	let {
		hoveredPoint: hoveredPoint = $bindable(),
		hoveredIndex = $bindable(),
		height = 100,
		data,
		theme = 'primary',
		isLoading = false,
		styleType = 'balance',
		showYAxis = false,
		series,
		mode = 'line',
		formatValue = (v: number) => String(v),
		formatTick,
		emptyLabel = 'No data in this period'
	}: Props = $props();

	const gradientId = `lc-gradient-${gradientSeq++}`;

	const multi = $derived(series != undefined);
	/** Series worth drawing: a flat-zero asset is noise, not information. */
	const shown = $derived((series ?? []).filter((s) => s.values.some((v) => Math.abs(v) > 1e-9)));
	const multiEmpty = $derived(multi && shown.length === 0);

	/** True whenever a y axis is drawn — it needs a left gutter for the tick
	 *  labels and a sliver at the bottom so the lowest one isn't half cut off. */
	const hasYAxis = $derived((showYAxis || multi) && styleType === 'balance');
	const margin = $derived({
		top: 8,
		right: multi ? 8 : 0,
		bottom: hasYAxis ? 7 : 0,
		left: hasYAxis ? 52 : 0
	});

	const dateExtent = $derived(extent(data, (d) => new Date(d.date)) as [Date, Date]);
	const xScale = $derived(
		scaleTime()
			.domain(dateExtent)
			.range([margin.left, width - margin.right])
	);

	let minRange = 0.02; // Minimum $0.02 range (2 cents)

	/** Cumulative tops per index, in stack order, so a band's lower edge is
	 *  the previous band's upper edge. */
	const stacked = $derived.by(() => {
		const tops: number[][] = [];
		const running = new Array(data.length).fill(0);
		for (const s of shown) {
			tops.push(data.map((_, i) => (running[i] += Math.max(0, s.values[i] ?? 0))));
		}
		return tops;
	});

	const yScale = $derived.by((): ScaleLinear<number, number> => {
		let scale: ScaleLinear<number, number>;

		if (multi) {
			let maxVal = 0;
			if (mode === 'stacked') {
				const top = stacked[stacked.length - 1];
				if (top) for (const v of top) if (v > maxVal) maxVal = v;
			} else {
				for (const s of shown) for (const v of s.values) if (v > maxVal) maxVal = v;
			}
			return scaleLinear()
				.domain([0, maxVal > 0 ? maxVal : 1])
				.nice()
				.range([height - margin.bottom, margin.top]);
		}

		if (styleType === 'trend') {
			const [min, maxVal] = extent(data, (d) => d.value) as [number, number];
			const range = maxVal - min;

			if (Math.abs(range) < minRange) {
				const center = (min + maxVal) / 2;
				const halfMinRange = minRange / 2;
				scale = scaleLinear()
					.domain([center - halfMinRange, center + halfMinRange])
					.range([height - margin.bottom, margin.top]);
			} else {
				scale = scaleLinear()
					.domain([min, maxVal])
					.range([height - margin.bottom, margin.top]);
			}
		} else {
			const maxVal = data.length > 0 ? max(data, (d) => d.value)! : 1;
			scale = scaleLinear()
				.domain([0, maxVal])
				.nice()
				.range([height - margin.bottom, margin.top]);
		}

		return scale;
	});

	const yTicks = $derived(hasYAxis ? yScale.ticks(multi ? 4 : 5) : []);

	function formatYTick(value: number): string {
		if (formatTick) return formatTick(value);
		if (value >= 1000) return value / 1000 + 'K';
		return String(value);
	}

	function getSpacedDates(extent: [Date, Date], count: number): moment.Moment[] {
		const [start, end] = extent.map((v) => moment(v));
		let dayDiff = end.diff(start, 'days');
		let perDiff = dayDiff / count;
		start.add(perDiff / 2, 'days');
		const out: moment.Moment[] = [];
		for (let i = 0; i < count; i++) {
			const shift = Math.floor(perDiff * i);
			out.push(start.clone().add(shift, 'days'));
		}

		return out;
	}
	const daysSpacing = $derived.by(() => {
		const daysApart = moment(dateExtent[1]).diff(moment(dateExtent[0]), 'days');
		return daysApart > 7 ? 5 : daysApart;
	});
	const spacedDates = $derived(getSpacedDates(dateExtent, daysSpacing));
	let lineGenerator = area<{ value: number; date: Date }>()
		.y((d) => yScale(d.value))
		.x((d) => xScale(d.date))
		.curve(curveMonotoneX);
	let areaGenerator = area<{ value: number; date: Date }>()
		.y0(() => height)
		.y1((d) => yScale(d.value))
		.x((d) => xScale(d.date))
		.curve(curveMonotoneX);
	let areaPlot = $derived(areaGenerator(data));
	let linePlot = $derived(lineGenerator(data));

	/** Multi-series paths reuse the same generators by mapping each series'
	 *  values back onto the shared dates. */
	const seriesLine = $derived((values: number[]) =>
		lineGenerator(data.map((d, i) => ({ date: d.date, value: values[i] ?? 0 })))
	);
	const bandPath = $derived((idx: number) => {
		const top = stacked[idx];
		if (!top) return null;
		const below = idx === 0 ? data.map(() => 0) : stacked[idx - 1];
		return area<{ value: number; date: Date }>()
			.x((d) => xScale(d.date))
			.y0((_, i) => yScale(below[i]))
			.y1((d) => yScale(d.value))
			.curve(curveMonotoneX)(data.map((d, i) => ({ date: d.date, value: top[i] })));
	});

	let dotX: number = $state(0);
	let dotY: number = $state(untrack(() => height) + 10);
	let dotR: number = $state(0);
	let dotAnimRunningState = { pos: { x: 0, toIdx: 0 }, r: 0 };
	type DotAnimatable = { pos: { x: number; toIdx: number }; r: number };
	let dotAnim = createAnimation({ pos: { x: 0, toIdx: 0 }, r: 0 }, getSlerp(0.2));
	let updateLayer = getUpdateLayer<DotAnimatable>();

	let signal = new AbortController();
	updateLayer.mount(dotAnim, signal);
	updateLayer.subscribe(
		'afterUpdate',
		(anim) => {
			let {
				pos: { x, toIdx },
				r
			} = getStateTree(anim, dotAnimRunningState, false);
			let leftPos = data[Math.floor(toIdx)];
			let rightPos = data[Math.ceil(toIdx)];
			if (leftPos != undefined && rightPos != undefined) {
				dotX = x;
				dotY = yScale(lerpFunc(leftPos.value, rightPos.value, toIdx % 1));
				dotR = r;
			}
		},
		signal
	);
	const chunkSize = $derived.by(() => {
		const usableWidth = width - margin.left - margin.right;
		if (data.length <= 1) return usableWidth || 1;
		return usableWidth / (data.length - 1);
	});
	function setLinePos(e: MouseEvent) {
		if (!data || data.length === 0) return;

		const bb = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const idx = pointerIndex(e.clientX, bb.left, margin.left, chunkSize, data.length - 1);
		if (idx == null) return;

		hoveredIndex = idx;
		hoveredPoint = data[idx];
		if (!hoveredPoint) return;
		// The animated dot tracks one line; in multi-series mode the crosshair
		// and a dot per series are drawn straight from `hoveredIndex` instead.
		if (multi) return;
		if (dotR == 0) {
			changeLocalInterpFunction(dotAnim.children.pos, NO_INTERP);
		}
		modifyTo(dotAnim, {
			pos: { x: xScale(hoveredPoint.date), toIdx: hoveredIndex },
			r: 1
		});
		if (dotR == 0) {
			changeLocalInterpFunction(dotAnim.children.pos, getLinearInterp(0.05));
		}
	}

	function unsetLinePos() {
		modifyTo(dotAnim, { r: 0 });
		hoveredPoint = undefined;
		hoveredIndex = undefined;
	}

	function onKey(e: KeyboardEvent) {
		if (!multi || data.length === 0) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			const cur = hoveredIndex ?? data.length - 1;
			const next = Math.min(data.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
			hoveredIndex = next;
			hoveredPoint = data[next];
		} else if (e.key === 'Escape') {
			unsetLinePos();
		}
	}

	const crosshairX = $derived(
		hoveredIndex == undefined || !data[hoveredIndex] ? 0 : xScale(data[hoveredIndex].date)
	);
	/** Keep the readout inside the plot: flip it left of the crosshair once
	 *  the pointer passes the two-thirds mark. */
	const tipFlipped = $derived(crosshairX > margin.left + (width - margin.left) * 0.62);
	const spanDays = $derived(moment(dateExtent[1]).diff(moment(dateExtent[0]), 'days'));
	/** The legend reads the hovered point, falling back to the latest value. */
	const legendIndex = $derived(hoveredIndex ?? data.length - 1);
	/** One end label per series, but only while they stay ≥ 14px apart —
	 *  nudged labels detach from their lines. A stack gets one: the total. */
	const endLabels = $derived.by(() => {
		if (!multi || shown.length === 0 || data.length === 0) return [];
		const lastIdx = data.length - 1;
		if (mode === 'stacked') {
			const top = stacked[stacked.length - 1]?.[lastIdx] ?? 0;
			return [{ y: yScale(top), text: formatValue(top) }];
		}
		if (shown.length > 4) return [];
		const ys = shown.map((s) => yScale(s.values[lastIdx] ?? 0));
		const sorted = [...ys].sort((a, b) => a - b);
		for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] < 14) return [];
		return shown.map((s, i) => ({ y: ys[i], text: formatValue(s.values[lastIdx] ?? 0) }));
	});
	// FEAT: animate range change https://d3-graph-gallery.com/graph/line_change_data.html
</script>

<figure class={[theme, { zero: width == 0 }]} bind:clientWidth={width} tabindex="-1">
	{#if isLoading || (!multi && data.length === 0)}
		<div class="loading-overlay">
			<WaveLoading />
			<span>Loading chart data...</span>
		</div>
	{:else if multiEmpty}
		<div class="loading-overlay"><span>{emptyLabel}</span></div>
	{/if}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<svg
		{height}
		onpointermove={setLinePos}
		onpointerdown={setLinePos}
		ontouchend={unsetLinePos}
		onmouseleave={unsetLinePos}
		onkeydown={onKey}
		onblur={unsetLinePos}
		tabindex={multi ? 0 : -1}
		role="figure"
		class={{ loading: isLoading }}
	>
		{#each yTicks as tickVal}
			{#if multi}
				<line
					class="grid"
					x1={margin.left}
					x2={width - margin.right}
					y1={yScale(tickVal)}
					y2={yScale(tickVal)}
				></line>
			{/if}
			<text
				x={margin.left - 8}
				y={yScale(tickVal)}
				text-anchor="end"
				dominant-baseline="middle"
				class="y-tick"
			>
				{formatYTick(tickVal)}
			</text>
		{/each}

		{#if multi}
			{#if mode === 'stacked'}
				{#each shown as s, i (s.key)}
					<path class="band" d={bandPath(i)} fill={s.color} />
				{/each}
			{:else}
				{#each shown as s (s.key)}
					<path class="series-line" d={seriesLine(s.values)} stroke={s.color}></path>
				{/each}
			{/if}

			{#if hoveredIndex != undefined && !multiEmpty}
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
					<circle class="series-dot" cx={crosshairX} cy={yScale(v)} r="4" fill={s.color} />
				{/each}
			{/if}

			{#each endLabels as l}
				<text class="end-label" x={width - margin.right} y={l.y - 7} text-anchor="end">
					{l.text}
				</text>
			{/each}
		{:else}
			<path d={areaPlot} stroke="none" stroke-width={0} fill="url(#{gradientId})"></path>
			<path d={linePlot} stroke="var(--fg-mid)" stroke-width={1}></path>
			<line
				x1={dotX}
				y1={height - margin.bottom}
				x2={dotX}
				y2={dotY}
				stroke="var(--fg-mid)"
				stroke-width={dotR * 1}
			></line>
			<circle
				cx={dotX}
				cy={dotY}
				r={dotR * 4}
				fill="var(--bg)"
				stroke="var(--fg-mid)"
				stroke-width={1}
			></circle>
		{/if}
		<defs>
			<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
				<stop offset="5%" stop-color="var(--bg-accent)" stop-opacity="1" />
				<stop offset="95%" stop-color="var(--bg)" stop-opacity="0" />
			</linearGradient>
		</defs>
	</svg>

	{#if multi && hoveredIndex != undefined && !multiEmpty}
		<div
			class="tooltip"
			class:flipped={tipFlipped}
			style:--x="{crosshairX}px"
			role="status"
			aria-live="polite"
		>
			<span class="tip-date">
				{moment(data[hoveredIndex].date).format(spanDays <= 2 ? 'MMM D, HH:mm' : 'MMM D, YYYY')}
			</span>
			{#each shown as s (s.key)}
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

	{#if styleType === 'balance'}
		<div class="dates">
			{#each spacedDates as date}
				<span class="date" style={`--position: ${xScale(date.toDate())}px`}
					>{date.format('MMM DD')}</span
				>
			{/each}
		</div>
		<figcaption>A graph of your balance over time.</figcaption>
	{:else}
		<figcaption>A graph of recent coin prices.</figcaption>
	{/if}

	{#if multi && shown.length > 0}
		<ul class="legend">
			{#each shown as s (s.key)}
				<li>
					<span class="swatch" style:background={s.color}></span>
					<span class="legend-label">{s.label}</span>
					<span class="legend-value">{formatValue(s.values[legendIndex] ?? 0)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</figure>

<style>
	figure {
		position: relative;
		touch-action: pinch-zoom pan-y;
		transition:
			opacity 0.05s,
			filter 0.3s ease;
		opacity: 1;
	}
	svg.loading {
		filter: blur(2px) grayscale(0.5);
		opacity: 0.6;
	}
	svg:focus-visible {
		outline: 1px solid var(--dash-text-accent);
		outline-offset: 2px;
		border-radius: 8px;
	}
	figcaption {
		overflow: hidden;
		height: 0;
		width: 0;
	}
	svg {
		width: 100%;
		/* Tick labels are anchored inside the left gutter; without this the
		   svg viewport clips the widest of them mid-glyph. */
		overflow: visible;
	}
	.dates {
		position: relative;
		height: calc(var(--text-xs) + 0.5rem);
	}
	/* hide graph until width determined */
	.zero {
		opacity: 0;
	}
	.date {
		position: absolute;
		left: var(--position);
		top: 50%;
		transform: translate(-50%, -50%);
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		white-space: nowrap;
	}
	svg .y-tick {
		fill: var(--dash-text-muted);
		font-size: var(--text-xs);
	}
	svg .grid {
		stroke: var(--dash-chart-grid);
		stroke-width: 1;
	}
	svg .end-label {
		fill: var(--dash-text-secondary);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	svg .series-line {
		fill: none;
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	/* Part-to-whole bands: the 2px separation is drawn in the surface colour,
	   never as a border in the series colour. */
	svg .band {
		opacity: 0.78;
		stroke: var(--viz-surface);
		stroke-width: 2;
	}
	svg .crosshair {
		stroke: var(--dash-text-muted);
		stroke-width: 1;
	}
	svg .series-dot {
		stroke: var(--viz-surface);
		stroke-width: 2;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1.1rem;
		list-style: none;
		margin: 0.4rem 0 0;
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
	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		z-index: 3;
		font-size: var(--text-sm);
		color: var(--dash-text-muted);
		backdrop-filter: blur(1px);
	}
</style>
