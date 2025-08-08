<script lang="ts">
	import * as progress from '@zag-js/progress';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	import { untrack } from 'svelte';
	type Props = {
		boundaries: { min: number; max: number };
		currentValue: number | null;
		colorVar?: string;
		timerLabel?: string;
	};
	let { boundaries, currentValue, colorVar = '--accent-mid', timerLabel }: Props = $props();
	let percentage = $derived.by(() => {
		if (currentValue !== null) {
			if (currentValue === 0) {
				return 0;
			} else {
				return Math.floor((Math.max(currentValue, boundaries.min) / boundaries.max) * 100);
			}
		}
		return null;
	});

	const id = getUniqueId();
	let service = $state(
		useMachine(progress.machine, {
			id,
			min: 0,
			max: 100
		})
	);
	const api = $derived(progress.connect(service, normalizeProps));

	$effect(() => {
		if (api.value !== percentage) api.setValue(percentage);
	});

	function formatNumber(n: number): string {
		// Helper function to format to 4 significant figures
		function toSignificantFigures(num: number, sigFigs: number = 4): number {
			if (num === 0) return 0;
			const magnitude = Math.floor(Math.log10(Math.abs(num)));
			const factor = Math.pow(10, sigFigs - 1 - magnitude);
			return Math.round(num * factor) / factor;
		}

		if (n >= 1e15) {
			const quadrillions = toSignificantFigures(n / 1e15);
			return `${quadrillions}q`;
		} else if (n >= 1e12) {
			const trillions = toSignificantFigures(n / 1e12);
			return `${trillions}t`;
		} else if (n >= 1e9) {
			const billions = toSignificantFigures(n / 1e9);
			return `${billions}b`;
		} else if (n >= 1e6) {
			const millions = toSignificantFigures(n / 1e6);
			return `${millions}m`;
		} else if (n >= 1e3) {
			const thousands = toSignificantFigures(n / 1e3);
			return `${thousands}k`;
		}

		return toSignificantFigures(n).toString();
	}
</script>

<div {...api.getRootProps()} style={`--bar-color: var(${colorVar})`}>
	<div {...api.getLabelProps()}>
		<span class="coin-amt current">
			{#if currentValue !== null}
				{formatNumber(currentValue)}
			{:else}
				Loading...
			{/if}
		</span>
		<span class="coin-amt max">
			{#if currentValue !== null}
				/ {formatNumber(boundaries.max)}
			{/if}
		</span>
	</div>
	<div {...api.getTrackProps()}>
		<div {...api.getRangeProps()}></div>
	</div>
	<div {...api.getValueTextProps()}>
		<span class="legend">
			<span class="legend-label">Available</span>
			<span class="legend-icon"> </span>
		</span>
		<span class="percentage">
			{#if timerLabel}
				{timerLabel} -
			{/if}
			{#if currentValue && currentValue < boundaries.min}
				&lt;
			{/if}
			{percentage ?? 0}%
		</span>
	</div>
</div>

<style lang="scss">
	// [data-scope="progress"][data-part="root"] {

	// }
	[data-scope='progress'][data-part='label'] {
		display: flex;
		flex-direction: row;
		width: 100%;
		align-items: baseline;
		.coin-amt {
			font-family: 'Noto Sans Mono Variable', monospace;
			font-weight: 400;
		}
		.coin-amt.current {
			font-size: var(--text-2xl);
		}
		.coin-amt.max {
			width: 100%;
			text-align: right;
			height: fit-content;
		}
	}
	[data-scope='progress'][data-part='track'] {
		height: 0.5rem;
		background-color: var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem;
		overflow: hidden;
		position: relative;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	[data-scope='progress'][data-part='range'] {
		height: 100%;
		background-color: var(--bar-color);
		border-radius: 0.5rem;
		transition: width 0.3s ease;
		position: absolute;
		top: 0;
		left: 0;
	}

	[data-scope='progress'][data-part='value-text'] {
		display: flex;
		flex-direction: row;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
		.percentage {
			width: 100%;
			text-align: right;
		}
		.legend {
			display: grid;
			max-width: max-content;
			grid-template-areas: 'legend-label	legend-icon';
			align-items: center;
			gap: 0.25rem;
		}
		.legend-label {
			grid-area: legend-label;
		}
		.legend-icon {
			grid-area: legend-icon;
			width: 0.5rem;
			height: 0.5rem;
			border-radius: 0.5rem;
			background-color: var(--bar-color);
		}
	}

	[data-scope='progress'][data-part='range'][data-state='indeterminate'] {
		background: linear-gradient(
			90deg,
			transparent 0%,
			transparent 40%,
			var(--bar-color) 50%,
			transparent 60%,
			transparent 100%
		);
		background-size: 300% 100%;
		animation: loading-sweep 5s linear infinite;
		width: 100% !important; /* Override zag-js width for loading state */
	}

	@keyframes loading-sweep {
		0% {
			background-position: 300% 0;
		}
		100% {
			background-position: -300% 0;
		}
	}
</style>
