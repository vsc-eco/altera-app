<script lang="ts">
	import { scaleLinear, scaleTime } from 'd3-scale';
	import { extent, max, min } from 'd3-array';
	import { curveBasis, area, curveBasisClosed, curveLinear } from 'd3-shape';
	import {
		addLocalListener,
		changeInterpFunction,
		changeLocalInterpFunction,
		createAnimation,
		getLinearInterp,
		getLocalState,
		getSlerp,
		getStateTree,
		lerpFunc,
		modifyTo,
		NO_INTERP,
		updateAnimation
	} from 'aninest';
	import { getStateTreeProxy, getUpdateLayer } from '@aninest/extensions';
	let updateLayer = getUpdateLayer();
	let values = [30, 40, 45, 50, 49, 60, 61, 64, 62, 66, 67, 67, 74, 82, 84, 87, 89, 91];
	const margin = { top: 4, right: 4, bottom: 0, left: 0 };
	let defaultData = values.map((data, idx) => {
		let start = new Date('November 1');
		let out = new Date(start.setDate(start.getDate() + idx));
		return {
			value: data,
			date: out
		};
	});
	type Point = {
		value: number;
		date: Date;
	};
	type Props = {
		hoveredValue?: Point;
		width?: number;
		height?: number;
		data?: Point[];
	};
	let {
		hoveredValue: hoveredPoint = $bindable(),
		width = 200,
		height = 100,
		data = defaultData
	}: Props = $props();
	let xScale = $derived(
		scaleTime()
			.domain(extent(data, (d) => new Date(d.date)) as [Date, Date])
			.range([margin.left, width - margin.right])
	);
	let yScale = $derived(
		scaleLinear()
			.domain([0, max(data, (d) => d.value)!])
			.range([height - margin.bottom, margin.top])
	);
	let lineGenerator = area<{ value: number; date: Date }>()
		.y((d) => yScale(d.value))
		.x((d) => xScale(d.date))
		.curve(curveBasis);
	let areaGenerator = area<{ value: number; date: Date }>()
		.y0((d) => height)
		.y1((d) => yScale(d.value))
		.x((d) => xScale(d.date))
		.curve(curveBasis);
	let areaPlot = $derived(areaGenerator(data));
	let linePlot = $derived(lineGenerator(data));
	let dotX: number = $state(0);
	let dotY: number = $state(height + 10);
	let dotR: number = $state(0);
	let dotAnim = createAnimation({ pos: { x: 0, y: 0 }, r: 0 }, getSlerp(0.1));
	updateLayer.mount(dotAnim);
	updateLayer.subscribe('afterUpdate', () => {
		let {
			pos: { x, y },
			r
		} = getStateTree(dotAnim);
		dotX = x;
		dotY = y;
		dotR = r;
	});
	function setLinePos(e: PointerEvent) {
		let bb = (e.currentTarget as HTMLElement).getBoundingClientRect();

		let fromLeft = e.clientX - bb.left + margin.left;
		let chunkSize = (bb.width - margin.left - margin.right) / (data.length - 1);
		let fromLeftChunk = Math.round(fromLeft / chunkSize);
		hoveredPoint = data[fromLeftChunk];
		if (dotR == 0) {
			changeLocalInterpFunction(dotAnim.children.pos, NO_INTERP);
		}
		modifyTo(dotAnim, {
			pos: { x: xScale(hoveredPoint.date), y: yScale(hoveredPoint.value) },
			r: 1
		});
		if (dotR == 0) {
			changeLocalInterpFunction(dotAnim.children.pos, getLinearInterp(0.05));
		}
	}

	function unsetLinePos() {
		modifyTo(dotAnim, { r: 0 });
		hoveredPoint = undefined;
	}
</script>

<figure>
	<svg {width} {height} onpointermove={setLinePos} onmouseleave={unsetLinePos} role="figure">
		<path d={linePlot} stroke="var(--primary-bg-mid)" stroke-width={4}></path>
		<path d={areaPlot} stroke="none" stroke-width={0} fill="url(#MyGradient)"></path>
		<line
			x1={dotX}
			y1={height - margin.bottom}
			x2={dotX}
			y2={dotY}
			stroke="var(--primary-bg-mid)"
			stroke-width={dotR * 2}
		></line>
		<circle
			cx={dotX}
			cy={dotY}
			r={dotR * 4}
			fill="var(--primary-bg)"
			stroke="var(--primary-bg-mid)"
			stroke-width={2}
		></circle>
		<defs>
			<linearGradient id="MyGradient" x1="0" y1="0" x2="0" y2="1" gradientTransform="rotate(0)">
				<stop offset="5%" stop-color="var(--primary-bg)" stop-opacity="1" />
				<stop offset="95%" stop-color="var(--primary-bg)" stop-opacity="0" />
			</linearGradient>
		</defs>
	</svg>
</figure>

<style>
</style>
