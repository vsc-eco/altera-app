<script lang="ts">
	import LineChart, { type Point } from '$lib/LineChart.svelte';
	import moment from 'moment';
	import Card from '../Card.svelte';
	import Diff from './Diff.svelte';
	import Date from './Date.svelte';
	import { getAuth } from '$lib/auth/store';
	import { accountBalanceHistory, fetchAndStoreAccountBalances } from '$lib/stores/balanceHistory';
	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);
	let loadingBalances = $state(true);
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
	const active = $derived(
		hoveredPoint ??
			($accountBalanceHistory?.length > 0
				? $accountBalanceHistory[$accountBalanceHistory.length - 1]
				: null)
	);
	const balance = $derived(active?.value ?? 0);
	const dateRanges = [
		{
			label: 'Last 7 Days',
			start: moment().subtract(7, 'days').toDate(),
			end: moment().toDate()
		},
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
		},
		{
			label: 'This Month',
			start: moment().startOf('month').toDate(),
			end: moment().toDate()
		},
		{
			label: 'Year to Date',
			start: moment().startOf('year').toDate(),
			end: moment().toDate()
		}
	];
	let selectedDateRange = $state(dateRanges[0]);
	let hourly = $derived(moment(selectedDateRange.end).diff(selectedDateRange.start, 'day') < 14);
	let interval = $derived(hourly ? moment.duration(1, 'hour') : moment.duration(1, 'day'));
	let filteredData = $derived(
		$accountBalanceHistory.filter((v) => {
			return v.date.getTime() > selectedDateRange.start.getTime();
		})
	);
	const date = $derived(hoveredPoint && active?.date);
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

	$effect(() => {
		if (!selectedDateRange && dateRanges.length > 0) {
			selectedDateRange = dateRanges[0];
		}
	});

	$effect(() => {
		if (did && selectedDateRange) {
			loadingBalances = true;
			fetchAndStoreAccountBalances(did, selectedDateRange.start, selectedDateRange.end, interval)
				.then(() => {
					loadingBalances = false;
				})
				.catch(() => {
					loadingBalances = false;
				});
		}
	});
</script>

<Card>
	<div class={['root', { hovered: hoveredIndex }]}>
		<div class="caption">
			<h5>Magi Balance</h5>
			<div class="price">
				{#if loadingBalances}
					<span class="loading">Loading...</span>
				{:else}
					${Math.floor(balance)}<span
						><span>.</span>{new Intl.NumberFormat('en-US', {
							style: 'decimal',
							maximumFractionDigits: 0,
							minimumIntegerDigits: 2
						}).format((balance * 100) % 100)}</span
					>
				{/if}
			</div>
		</div>

		<div class="date-change-bar">
			<div class={['date', { hovered: date }]}>
				<Date
					onValueChange={(v) => {
						selectedDateRange = v;
					}}
					{dateRanges}
					currDate={date}
					{hourly}
				></Date>
			</div>
			{#if !loadingBalances}
				<div class="change">
					<Diff up={priceDiff[0]} down={priceDiff[1]} compact={hoveredPoint == undefined} />
				</div>
			{/if}
		</div>
		<div class="lc-wrapper">
			<LineChart
				data={filteredData}
				bind:hoveredPoint
				bind:hoveredIndex
				height={220}
				isLoading={loadingBalances}
			/>
		</div>
	</div>
</Card>

<style lang="scss">
	.root {
		display: block;
		min-width: min(300px, 100%);
		flex-basis: 450px;
	}
	.root > :global(div) {
		height: 100%;
		box-sizing: border-box;
	}
	.caption {
		margin: 0.75rem;
		margin-top: 0;
	}
	.date-change-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 3.5rem;
		margin-right: 0.75rem;
		.hovered {
			margin-left: 0.75rem;
		}
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
