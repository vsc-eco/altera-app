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
		styleType?: 'default' | 'card' | 'dropdown';
		disabled?: boolean;
		placeholder?: string;
		onValueChange?: (value: ValueChangeDetails<Option>) => void;
	};
	let {
		items: options,
		initial,
		onValueChange,
		styleType = 'default',
		disabled,
		placeholder
	}: Props = $props();
	// pass items with snippet and snippetData in order to render a snippet and not just the label

	let currentOptions = options;

	function getValue(opt: Option): string {
		return opt.value ?? opt.label;
	}

	const collection = select.collection({
		items: options,
		itemToString: (item) => item.label,
		itemToValue: getValue,
		isItemDisabled: (item) => item.disabled
	});
	const service = useMachine(select.machine, {
		id: getUniqueId(),
		defaultValue: initial ? [initial] : undefined,
		collection,
		onValueChange,
		positioning:
			styleType === 'default'
				? {}
				: {
						placement: 'bottom-start',
						sameWidth: true,
						gutter: 0,
						shift: 0
					}
	});
	const api = $derived(select.connect(service, normalizeProps));

	$effect(() => {
		api.collection.items = options;
	});
	$effect(() => {
		if (initial) {
			untrack(() => {
				if (api.value[0] !== initial) {
					api.selectValue(initial);
				}
			});
		} else {
			untrack(() => api.clearValue());
		}
	});

	// clears the value if the options change
	$effect(() => {
		const newOptions = options;
		const newVals = new Set(newOptions.map((opt) => getValue(opt)));
		const currentVals = new Set(currentOptions.map((opt) => getValue(opt)));
		if (newVals.difference(currentVals).size > 0 || currentVals.difference(newVals).size > 0) {
			untrack(() => {
				if (newOptions.length === 1) {
					api.selectValue(getValue(newOptions[0]));
				} else if (
					api.value.length > 0 &&
					!newOptions.find((opt) => getValue(opt) === api.value[0])
				) {
					api.clearValue();
				}
			});
			currentOptions = newOptions;
		}
	});
	$effect(() => {
		if (options.find((opt) => opt.value === api.value[0])?.disabled) {
			api.clearValue();
		}
	});
</script>

<div {...api.getRootProps()} class={{ card: styleType !== 'default' }}>
	<Toggle
		{api}
		placeholder={placeholder || 'Select option'}
		{disabled}
		items={options}
		{styleType}
	/>

	<div {...api.getPositionerProps()} class={{ card: styleType !== 'default' }}>
		<List {api} selectData={api.collection.items} {styleType} />
	</div>
</div>

<style lang="scss">
	[data-part='root'].card {
		width: 100%;
		display: flex;
	}
	// [data-part='positioner'].card {
	// 	margin-left: calc(0.5rem - var(--x));
	// 	margin-right: calc(0.5rem - var(--x));
	// 	width: calc(var(--reference-width) - 2 * (0.5rem - var(--x))) !important;
	// }
	.dropdown {
		background-color: var(--bg-accent);
		z-index: 5;
	}
	div {
		position: relative;
	}
</style>
