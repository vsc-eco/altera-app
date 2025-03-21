<script lang="ts">
	import { defaultData } from '$lib/defaultData';
	import LineChart, { type Point } from '$lib/LineChart.svelte';
	import moment from 'moment';
	import Card from './Card.svelte';
	import Diff from './Balance/Diff.svelte';
	import Date from './Balance/Date.svelte';
	let data: Point[] = $state(defaultData);
	function calcTotalChange(data: { value: number }[]) {
		let up = 0;
		let down = 0;
		for (let i = 1; i < data.length; i++) {
			let prevPoint = data[i - 1];
			let diff = data[i].value - prevPoint.value;
			if (diff > 0) {
				up += diff;
			} else {
				down -= diff;
			}
		}
		return [up, down];
	}
	let hoveredPoint: Point | undefined = $state();
	let hoveredIndex: number | undefined = $state();
	const active = $derived(hoveredPoint ?? data?.[data.length - 1]);
	const balance = $derived(active.value);
	const dateRanges = [
		{ label: 'Last 7 Days', start: moment().subtract(7, 'days').toDate(), end: moment().toDate() },
		{
			label: 'Last 30 Days',
			start: moment().subtract(30, 'days').toDate(),
			end: moment().toDate()
		},
		{
			label: 'Last 90 Days',
			start: moment().subtract(90, 'days').toDate(),
			end: moment().toDate()
		},
		{
			label: 'Last 365 Days',
			start: moment().subtract(365, 'days').toDate(),
			end: moment().toDate()
		}
		// TODO: add month to date, quarter to date, year to date
	];
	let selectedDateRange = $state(dateRanges[0]);
	let filteredData = $derived(
		data.filter((v) => {
			return (
				v.date.getTime() > selectedDateRange.start.getTime() &&
				v.date.getTime() < selectedDateRange.end.getTime()
			);
		})
	);
	const date = $derived(hoveredPoint && active.date);
	const prev = $derived(hoveredIndex == undefined ? undefined : filteredData[hoveredIndex - 1]);
	const priceDiff = $derived(
		calcTotalChange(
			hoveredPoint
				? prev == undefined
					? [{ value: 0 }, { value: 0 }]
					: [prev, hoveredPoint]
				: filteredData
		)
	);
</script>

<div class={['root', { hovered: hoveredIndex }]}>
	<Card>
		<span class="caption">VSC Balance</span>
		<div class="price">
			{new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD',
				maximumFractionDigits: 0
			}).format(balance)}<span
				><span>.</span>{new Intl.NumberFormat('en-US', {
					style: 'decimal',
					maximumSignificantDigits: 2,
					minimumIntegerDigits: 2
				}).format((balance * 100) % 100)}</span
			>
		</div>
		<div class="date-change-bar">
			<div class="date">
				<Date
					onValueChange={(v) => {
						selectedDateRange = v;
					}}
					{dateRanges}
					currDate={date}
				></Date>
			</div>
			<div class="change">
				<Diff up={priceDiff[0]} down={priceDiff[1]} compact={hoveredPoint == undefined} />
			</div>
		</div>
		<div class="lc-wrapper">
			<LineChart data={filteredData} bind:hoveredPoint bind:hoveredIndex height={250} />
		</div>
	</Card>
</div>

<style>
	.root {
		display: block;
		max-width: 512px;
		min-width: min(300px, 100%);
	}
	.caption {
		font-size: var(--text-sm);
		color: var(--neutral-fg-mid);
	}
	.date-change-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 48px;
	}
	.price {
		vertical-align: text-top;
		display: flex;
		align-items: first;
		margin: 0.5rem 0;
		font-size: var(--text-5xl);
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	.price span:last-child {
		padding-top: 0.125rem;
		font-size: var(--text-1xl);
		span {
			font-size: var(--text-base);
			display: inline-flex;
			align-items: right;
			justify-content: end;
		}
	}
	.lc-wrapper {
		margin: 0 -0.5rem;
		overflow-x: auto;
	}
</style>
