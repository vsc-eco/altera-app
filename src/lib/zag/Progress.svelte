<script lang="ts">
	import * as progress from '@zag-js/progress';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	import { untrack } from 'svelte';
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
	<div {...api.getLabelProps()}>VSC Credits</div>
	<div {...api.getTrackProps()}>
		<div {...api.getRangeProps()}></div>
	</div>
	<div {...api.getValueTextProps()}>
		{Math.round((displayValue / boundaries.max) * 100)}%
	</div>
</div>

<style lang="scss">
    // [data-scope="progress"][data-part="root"] {
        
    // }
	// [data-scope="progress"][data-part="label"] {
	
	// }
	[data-scope='progress'][data-part='track'] {
		height: 0.5rem;
		background-color: var(--neutral-fg-accent);
		border-radius: 0.5rem;
		overflow: hidden;
		position: relative;
        margin: 0.5rem 0;
	}

	[data-scope='progress'][data-part='range'] {
		height: 100%;
		background-color: var(--primary-fg-mid);
		border-radius: 0.5rem;
		transition: width 0.3s ease;
		position: absolute;
		top: 0;
		left: 0;
	}

    [data-scope="progress"][data-part="value-text"] {
        color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
        text-align: right;
    }
</style>
