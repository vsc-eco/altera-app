<script lang="ts">
	import { defaultData } from '$lib/defaultData';
	import LineChart, { type Point } from '$lib/LineChart.svelte';
	import moment from 'moment';
	import Card from './Card.svelte';
	import Diff from './Balance/Diff.svelte';
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
	const active = $derived(hoveredPoint ?? data?.at(-1)!);
	const balance = $derived(active.value);
	const date = $derived(active.date);
	const prev = $derived(hoveredIndex == undefined ? undefined : data[hoveredIndex - 1]);
	const priceDiff = $derived(
		calcTotalChange(
			hoveredPoint
				? prev == undefined
					? [{ value: 0 }, { value: 0 }]
					: [prev, hoveredPoint]
				: data
		)
	);
</script>

<div class="root">
	<Card>
		<span class="caption">VSC Balance</span>
		<div class="price">
			{new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD',
				maximumFractionDigits: 0
			}).format(balance)}<span
				>.{new Intl.NumberFormat('en-US', {
					style: 'decimal',
					maximumSignificantDigits: 2,
					minimumIntegerDigits: 2
				}).format((balance * 100) % 100)}</span
			>
		</div>
		<div class="date-change-bar">
			<div class="date">
				{moment(date).format('MMMM D, YYYY')}
			</div>
			<div class="change">
				<Diff up={priceDiff[0]} down={priceDiff[1]} compact={hoveredPoint == undefined} />
			</div>
		</div>
		<div class="lc-wrapper">
			<LineChart bind:data bind:hoveredPoint bind:hoveredIndex width={350} height={200} />
		</div>
	</Card>
</div>

<style>
	.root {
		display: block;
		width: 350px;
		overflow: hidden;
	}
	.caption {
		font-size: var(--text-sm);
		color: var(--neutral-fg-mid);
	}
	.date-change-bar {
		display: flex;
		justify-content: space-between;
	}
	.price {
		vertical-align: text-top;
		display: flex;
		align-items: first;
		margin-top: 0.25rem;
		margin-bottom: 0.5rem;
		font-size: var(--text-5xl);
	}
	.price span:last-child {
		padding-top: 0.125rem;
		font-size: var(--text-1xl);
	}
	.lc-wrapper {
		margin-left: -0.55rem;
	}
</style>
