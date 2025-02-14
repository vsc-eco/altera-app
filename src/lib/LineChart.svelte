<script lang="ts">
	// TODO: Handle case where data points are not evenly spaced out in time
	// What breaks:
	// - the linear interp in the afterUpdate listener over toIdx since
	//   if values are not evenly spaced over x then the interp should vary
	//   from index gap to index gap.
	// - the mapping from mouse position to hoveredIndex
	import { scaleLinear, scaleTime } from 'd3-scale';
	import { extent, max } from 'd3-array';
	import { area, curveCardinal } from 'd3-shape';
	import {
		changeLocalInterpFunction,
		createAnimation,
		getLinearInterp,
		getStateTree,
		lerpFunc,
		modifyTo,
		NO_INTERP
	} from 'aninest';
	import { getUpdateLayer } from '@aninest/extensions';
	import { defaultData } from './defaultData';
	import moment from 'moment';
	let updateLayer = getUpdateLayer();
	const margin = { top: 8, right: 0, bottom: 0, left: 0 };
	export type Point = {
		value: number;
		date: Date;
	};
	type Props = {
		hoveredPoint?: Point;
		hoveredIndex?: number;
		height?: number;
		data?: Point[];
		theme?: string;
	};
	let width = $state(0);
	let {
		hoveredPoint: hoveredPoint = $bindable(),
		hoveredIndex = $bindable(),
		height = 100,
		data = $bindable(defaultData),
		theme = 'primary'
	}: Props = $props();
	const dateExtent = $derived(extent(data, (d) => new Date(d.date)) as [Date, Date]);
	const xScale = $derived(
		scaleTime()
			.domain(dateExtent)
			.range([margin.left, width - margin.right])
	);

	const yScale = $derived(
		scaleLinear()
			.domain([0, max(data, (d) => d.value)!])
			.range([height - margin.bottom, margin.top])
	);
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
	const spacedDates = $derived(getSpacedDates(dateExtent, 5));
	let lineGenerator = area<{ value: number; date: Date }>()
		.y((d) => yScale(d.value))
		.x((d) => xScale(d.date))
		.curve(curveCardinal);
	let areaGenerator = area<{ value: number; date: Date }>()
		.y0(() => height)
		.y1((d) => yScale(d.value))
		.x((d) => xScale(d.date))
		.curve(curveCardinal);
	let areaPlot = $derived(areaGenerator(data));
	let linePlot = $derived(lineGenerator(data));
	let dotX: number = $state(0);
	let dotY: number = $state(height + 10);
	let dotR: number = $state(0);
	let dotAnimRunningState = { pos: { x: 0, toIdx: 0 }, r: 0 };
	let dotAnim = createAnimation({ pos: { x: 0, toIdx: 0 }, r: 0 }, getLinearInterp(0.1));

	updateLayer.mount(dotAnim);
	updateLayer.subscribe('afterUpdate', () => {
		let {
			pos: { x, toIdx },
			r
		} = getStateTree(dotAnim, dotAnimRunningState, false);
		dotX = x;
		let leftPos = data[Math.floor(toIdx)];
		let rightPos = data[Math.ceil(toIdx)];
		dotY = yScale(lerpFunc(leftPos.value, rightPos.value, toIdx % 1));
		dotR = r;
	});
	let chunkSize = $derived((width - margin.left - margin.right) / (data.length - 1));
	function setLinePos(e: MouseEvent) {
		let bb = (e.currentTarget as HTMLElement).getBoundingClientRect();

		let fromLeft = e.clientX - bb.left + margin.left;
		let fromLeftChunk = Math.round(fromLeft / chunkSize);
		hoveredIndex = fromLeftChunk;
		hoveredPoint = data[fromLeftChunk];
		if (dotR == 0) {
			changeLocalInterpFunction(dotAnim.children.pos, NO_INTERP);
		}
		modifyTo(dotAnim, {
			pos: { x: xScale(hoveredPoint.date), toIdx: hoveredIndex },
			r: 1
		});
		if (dotR == 0) {
			changeLocalInterpFunction(dotAnim.children.pos, getLinearInterp(0.1));
		}
	}

	function unsetLinePos() {
		modifyTo(dotAnim, { r: 0 });
		hoveredPoint = undefined;
		hoveredIndex = undefined;
	}
</script>

<figure class={theme} bind:clientWidth={width}>
	<svg
		{width}
		{height}
		onpointermove={setLinePos}
		onpointerdown={setLinePos}
		ontouchend={unsetLinePos}
		onmouseleave={unsetLinePos}
		role="figure"
	>
		<path d={areaPlot} stroke="none" stroke-width={0} fill="url(#MyGradient)"></path>
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
		<defs>
			<linearGradient id="MyGradient" x1="0" y1="0" x2="0" y2="1">
				<stop offset="5%" stop-color="var(--bg-accent)" stop-opacity="1" />
				<stop offset="95%" stop-color="var(--bg)" stop-opacity="0" />
			</linearGradient>
		</defs>
	</svg>
	<div class="dates">
		{#each spacedDates as date}
			<span class="date">{date.format('MMM DD')}</span>
		{/each}
	</div>
</figure>

<style>
	figure {
		touch-action: pinch-zoom;
		min-width: 250px;
	}
	.dates {
		display: flex;
		justify-content: space-evenly;
	}
	.date {
		color: var(--neutral-fg-mid);
		font-size: var(--text-xs);
	}
</style>
