<script lang="ts" generics="Option extends {label: string, [key: string]: any}">
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
		styleType?: 'default' | 'card';
		disabled?: boolean;
		onValueChange?: (value: ValueChangeDetails<Option>) => void;
	};
	let { items: options, initial, onValueChange, styleType = 'default', disabled }: Props = $props();
	// pass items with snippet and snippetData in order to render a snippet and not just the label

	const collection = select.collection({
		items: options as Option[],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.value ?? item.label
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
			onValueChange,
			positioning: styleType === 'default' ? {} : {
				placement: 'bottom-start',
				flip: false,
				sameWidth: true,
				gutter: 0,
				shift: 0,
				
			}
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

<div {...api.getRootProps()} class={{card: styleType === 'card'}}>
	<Toggle {api} def={initial || 'Select option'} {disabled} items={options} {styleType}></Toggle>

	<div {...api.getPositionerProps()} class={{card: styleType === 'card'}}>
		<List {api} selectData={api.collection.items} {styleType}></List>
	</div>
</div>

<style lang="scss">
	[data-part='root'].card {
		width: 100%;
		display: flex;
		position: relative;
	}
	.dropdown {
		background-color: var(--bg-accent);
		z-index: 5;
	}
	div {
		position: relative;
	}
</style>
