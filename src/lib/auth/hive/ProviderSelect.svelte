<script lang="ts">
	import { getUniqueId } from '$lib/zag/Select/idgen';
	import * as radio from '@zag-js/radio-group';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import type { Snippet } from 'svelte';

	let items: { id: string; label: Snippet }[] = [];

	const service = useMachine(radio.machine, {
		id: getUniqueId(),
		name: 'fruit'
	});

	const api = $derived(radio.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<h3 {...api.getLabelProps()}>Fruits</h3>
	{#each items as opt}
		<label {...api.getItemProps({ value: opt.id })}>
			<span {...api.getItemTextProps({ value: opt.id })}>{opt.label}</span>
			<input {...api.getItemHiddenInputProps({ value: opt.id })} />
			<div {...api.getItemControlProps({ value: opt.id })}></div>
		</label>
	{/each}
</div>
