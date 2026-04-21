<script lang="ts">
	import LineChart, { type Point } from '$lib/LineChart.svelte';
	import moment from 'moment';
	import Card from '../Card.svelte';
	import Diff from './Diff.svelte';
	import DatePicker from './Date.svelte';
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
	let selectedDateRange = $state(dateRanges[1]);
	let hourly = $derived(moment(selectedDateRange.end).diff(selectedDateRange.start, 'day') < 14);
	let interval = $derived(hourly ? moment.duration(1, 'hour') : moment.duration(1, 'day'));
	// Mock data for visual demo — not used automatically
	const mockData = (() => {
		const points = [];
		const now = new Date();
		let val = 6800;
		for (let i = 30; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			val += (Math.random() - 0.42) * 400;
			val = Math.max(5000, Math.min(10000, val));
			points.push({ date: d, value: Math.round(val) });
		}
		return points;
	})();

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
		if (!did || !selectedDateRange) return;
		loadingBalances = true;
		fetchAndStoreAccountBalances(did, selectedDateRange.start, selectedDateRange.end, interval)
			.then(() => { loadingBalances = false; })
			.catch(() => { loadingBalances = false; });
	});
</script>

<Card>
	<div class={['root', { hovered: hoveredIndex }]}>
		<div class="header-row">
			<div class="title-area">
				<h5>Portfolio value</h5>
				{#if !loadingBalances}
					<div class="change-pill">
						<Diff up={priceDiff[0]} down={priceDiff[1]} compact={true} />
					</div>
				{/if}
			</div>
			<div class="date-select">
				<DatePicker
					onValueChange={(v) => {
						selectedDateRange = v;
					}}
					{dateRanges}
					{hourly}
				></DatePicker>
			</div>
		</div>
		<div class="lc-wrapper">
			<LineChart
				data={filteredData}
				height={280}
				isLoading={loadingBalances}
				showYAxis={false}
			/>
		</div>
	</div>
</Card>

<style lang="scss">
	.root {
		display: flex;
		flex-direction: column;
		min-width: min(280px, 100%);
		flex: 1;
	}
	.header-row {
		margin: 0.75rem;
		margin-top: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: nowrap;
		gap: 0.5rem;
		min-height: 2rem;
		flex-shrink: 0;
	}
	.header-row h5 {
		color: var(--dash-text-primary);
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0 !important;
	}
	.title-area {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.change-pill :global(.diff) {
		font-size: 0.75rem;
	}
	.lc-wrapper {
		margin: 0 -1.25rem -1.25rem;
		overflow-x: auto;
		flex: 1;
		min-height: 0;
		--fg-mid: var(--dash-chart-line);
		--bg-accent: var(--dash-chart-line);
		--bg: transparent;
	}

	@media (max-width: 600px) {
		.header-row {
			flex-wrap: wrap;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
		.date-select {
			width: 100%;
		}
	}
</style>
