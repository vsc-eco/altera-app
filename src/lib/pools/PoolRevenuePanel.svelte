<script lang="ts">
	import LineChart, { type Point } from '$lib/LineChart.svelte';
	import { getAuth } from '$lib/auth/store';
	import { numberFormatLanguage } from '$lib/constants';
	import { compactUsd } from '$lib/currency/compactUsd';
	import {
		fetchUserPoolRevenue,
		fetchUserPoolStarts,
		type PoolRevenueSeries
	} from '$lib/indexer/poolRevenueQueries';
	import { parseTs } from '$lib/indexer/btcBalanceHistory';
	import type { PoolRow } from './poolsData';
	import moment from 'moment';

	let { pool }: { pool: PoolRow } = $props();

	const auth = $derived(getAuth()());
	const did = $derived(auth.value?.did);

	let dates = $state<Date[]>([]);
	let revenue = $state<PoolRevenueSeries | null>(null);
	let loading = $state(true);
	/** Null until the lookup settles; false means this account never deposited
	 *  into this pool, which is a different message from "no fees yet". */
	let hasPosition = $state<boolean | null>(null);
	let skippedLegacyRows = $state(false);

	let hoveredPoint = $state<Point | undefined>();
	let hoveredIndex = $state<number | undefined>();

	const points = $derived<Point[]>(
		dates.map((date, i) => ({ date, value: revenue?.cumulativeUsd[i] ?? 0 }))
	);
	const total = $derived(revenue?.cumulativeUsd[dates.length - 1] ?? 0);
	const active = $derived(hoveredPoint?.value ?? total);
	/** Sub-cent LP revenue is normal on a small position, so the precision
	 *  follows the number rather than defaulting to cents. */
	const decimals = $derived(total > 0 && total < 1 ? 4 : 2);
	const usd = (v: number) =>
		`$${v.toLocaleString(numberFormatLanguage, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		})}`;

	/** The native per-asset split behind the figure being shown. */
	const assetSplit = $derived.by(() => {
		if (!revenue) return '';
		const i = hoveredIndex ?? dates.length - 1;
		return Object.entries(revenue.byAssetAt)
			.filter(([, amounts]) => (amounts[i] ?? 0) > 0)
			.map(
				([asset, amounts]) =>
					`${amounts[i].toLocaleString(numberFormatLanguage, {
						maximumSignificantDigits: 6
					})} ${asset.toUpperCase()}`
			)
			.join(' + ');
	});

	$effect(() => {
		const account = did;
		const contractId = pool.contractId;
		if (!account) {
			hasPosition = false;
			loading = false;
			return;
		}
		let cancelled = false;
		loading = true;
		(async () => {
			const starts = await fetchUserPoolStarts(account);
			const start = starts.get(contractId);
			if (cancelled) return;
			if (!start) {
				hasPosition = false;
				revenue = null;
				dates = [];
				return;
			}
			hasPosition = true;
			// The series is a balance, so it runs from the first deposit to now.
			// Hourly while that is short enough for a daily grid to look empty.
			const from = moment(parseTs(start)).startOf('hour');
			const hourly = moment().diff(from, 'day') < 3;
			const grid: Date[] = [];
			const cursor = hourly ? from.clone() : from.clone().startOf('day');
			const end = moment();
			while (cursor.isSameOrBefore(end)) {
				grid.push(cursor.toDate());
				cursor.add(1, hourly ? 'hour' : 'day');
			}
			if (grid.length === 0 || moment(grid[grid.length - 1]).isBefore(end)) {
				grid.push(end.toDate());
			}
			const result = await fetchUserPoolRevenue(account, [pool], grid);
			if (cancelled) return;
			dates = grid;
			revenue = result.pools[0] ?? null;
			skippedLegacyRows = result.skippedLegacyRows;
		})()
			.catch((err) => {
				console.error('Failed to load pool revenue', err);
				if (!cancelled) {
					revenue = null;
					hasPosition = false;
				}
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});
		return () => {
			cancelled = true;
		};
	});
</script>

<div class="revenue-panel">
	{#if hasPosition === false && !loading}
		<p class="msg">
			{did
				? 'You have never provided liquidity to this pool, so there are no fees to attribute.'
				: 'Sign in to see the fees your liquidity has earned in this pool.'}
		</p>
	{:else}
		<div class="head">
			<div class="figure">
				<span class="label">My earned fees</span>
				<span class="value">{usd(active)}</span>
				{#if assetSplit}
					<span class="split">{assetSplit}</span>
				{/if}
			</div>
			{#if hoveredPoint}
				<span class="at-date">{moment(hoveredPoint.date).format('MMM D, YYYY')}</span>
			{:else if dates.length > 0}
				<span class="at-date">since {moment(dates[0]).format('MMM D, YYYY')}</span>
			{/if}
		</div>

		<div class="chart">
			<LineChart
				data={points}
				height={220}
				isLoading={loading}
				showYAxis={true}
				formatTick={compactUsd}
				bind:hoveredPoint
				bind:hoveredIndex
			/>
		</div>

		<p class="footnote">
			Your share of the LP fees this pool charged while you held liquidity, valued at today's
			prices. Magi leaves LP fees in the pool, so this is value added to your position rather than
			a claimable balance.{#if skippedLegacyRows}
				{' '}Fees from before the pendulum fee layout record no asset and are excluded, as in the
				Fees figure above.{/if}
		</p>
	{/if}
</div>

<style lang="scss">
	.revenue-panel {
		padding: 1rem 0.25rem 0.5rem;
		min-height: 320px;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}
	.figure {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.label {
		color: var(--dash-text-secondary);
		font-size: var(--text-xs);
	}
	.value {
		color: var(--dash-text-primary);
		font-size: 1.35rem;
		font-weight: 600;
	}
	.split,
	.at-date {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
	}
	.chart {
		--fg-mid: var(--dash-chart-line);
		--bg-accent: var(--dash-chart-line);
		--bg: transparent;
	}
	.msg {
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
		padding: 3rem 1rem;
		text-align: center;
	}
	.footnote {
		color: var(--dash-text-muted);
		font-size: var(--text-xs);
		margin: 0.5rem 0 0;
	}
</style>
