<script lang="ts">
	import * as progress from '@zag-js/progress';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	type Props = {
		boundaries: { min: number; max: number };
		currentValue: number;
	};
	let { boundaries, currentValue }: Props = $props();
	let displayValue = $derived(Math.max(currentValue, boundaries.min));

	const id = getUniqueId();
	const service = useMachine(progress.machine, {
		id,
		min: boundaries.min,
		max: boundaries.max,
	});
	const api = $derived(progress.connect(service, normalizeProps));

	$effect(() => {
        api.setValue(displayValue)
	});
</script>

<div {...api.getRootProps()}>
	<div {...api.getLabelProps()}>
		<span class="coin-amt current">
			{currentValue * (10 ** -3)}
		</span>
		<span class="coin-amt max">
			/ {boundaries.max * (10 ** -3)}
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
			{#if currentValue < displayValue}
				&lt;
			{/if}
			{displayValue ? Math.round((displayValue / boundaries.max) * 100) : 0}%
		</span>
	</div>
</div>

<style lang="scss">
    // [data-scope="progress"][data-part="root"] {
        
    // }
	[data-scope="progress"][data-part="label"] {
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
		background-color: var(--primary-bg-mid);
		border-radius: 0.5rem;
		transition: width 0.3s ease;
		position: absolute;
		top: 0;
		left: 0;
	}

    [data-scope="progress"][data-part="value-text"] {
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
			grid-template-areas:
				'legend-label	legend-icon';
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
			background-color: var(--primary-bg-mid);
		}
    }
</style>
