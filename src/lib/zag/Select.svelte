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
		disabled?: boolean;
		onValueChange?: (value: ValueChangeDetails<Option>) => void;
	};
	let { items: options, initial, onValueChange, styleType, disabled }: Props = $props();

	const collection = select.collection({
		items: options as Option[],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.label
	});
	const userProps = $derived({
		id: getUniqueId(),
		defaultValue: initial ? [initial] : undefined,
		collection,
		onValueChange
	});
	const service = useMachine(
		untrack(() => select.machine),
		{
			id: getUniqueId(),
			defaultValue: initial ? [initial] : undefined,
			// svelte-ignore state_referenced_locally
			collection,
			onValueChange
		}
	);
	const api = $derived(select.connect(service, normalizeProps));
	$inspect(options);
	$effect(() => {
		// api.collection.setItems(options);
		api.collection.items = options;
	});
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
	<Toggle {api} def={initial || 'Select option'} {disabled}></Toggle>

	<div use:portal {...api.getPositionerProps()}>
		<List {api} selectData={api.collection.items}></List>
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
