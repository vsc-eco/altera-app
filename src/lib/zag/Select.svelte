<script lang="ts" generics="Option extends {label: string}">
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	import { untrack, type Snippet } from 'svelte';
	import type { ValueChangeDetails } from '@zag-js/select';
	import * as select from '@zag-js/select';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import Toggle from './Select/Toggle.svelte';
	import List from './Select/List.svelte';
	import { getUniqueId } from './idgen';
	type Props = {
		items: Option[];
		initial?: string;
		styleType?: 'default' | 'text';
		onValueChange?: (value: ValueChangeDetails<Option>) => void;
	};
	let { items: options, initial, onValueChange, styleType }: Props = $props();

	const collection = select.collection({
		items: options as Option[],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.label
	});

	const service = useMachine(select.machine, {
		id: getUniqueId(),
		defaultValue: initial ? [initial] : undefined,
		collection,
		onValueChange
	});
	const api = $derived(select.connect(service, normalizeProps));
	$inspect(initial);
	$effect(() => {
		if (initial) {
			untrack(() => {
				api.selectValue(initial);
			});
		} else {
			untrack(() => api.clearValue());
		}
	});
</script>

<div {...api.getRootProps()}>
	<Toggle {api} def={initial || 'Select option'}></Toggle>

	<div use:portal {...api.getPositionerProps()}>
		<List {api} selectData={options}></List>
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
