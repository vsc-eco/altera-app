<script lang="ts" generics="Option extends {label: string}">
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	import type { Snippet } from 'svelte';
	import type { ValueChangeDetails } from '@zag-js/select';
	import * as select from '@zag-js/select';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import Toggle from './Select/Toggle.svelte';
	import List from './Select/List.svelte';
	import { getUniqueId } from './Select/idgen';
	type Props = {
		items: Option[];
		initial?: string;
		onValueChange?: (value: ValueChangeDetails<unknown>) => void;
	};
	let { items: options, initial, onValueChange }: Props = $props();
	const selectData = $derived(options);

	const collection = select.collection({
		items: options as Option[],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.label
	});
	$effect(() => {
		collection.items = selectData;
	});

	const service = useMachine(select.machine, {
		id: getUniqueId(),
		collection,
		value: initial ? [initial] : undefined,
		onValueChange
	});
	const api = $derived(select.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<Toggle {api} def={initial || 'Select option'}></Toggle>

	<div use:portal {...api.getPositionerProps()}>
		<List {api} {selectData}></List>
	</div>
</div>

<style lang="scss">
	.dropdown {
		background-color: var(--bg-accent);
	}
	div {
		position: relative;
	}
</style>
