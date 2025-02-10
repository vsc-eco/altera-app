<script lang="ts" generics="Option extends {label: string}">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import type { ValueChangeDetails } from '@zag-js/select';
	import * as select from '@zag-js/select';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import { Check, ChevronDown, ChevronUp } from 'lucide-svelte';
	import Toggle from './Select/Toggle.svelte';
	import List from './Select/List.svelte';
	type Props = {
		options: Option[];
		initial?: string;
		onValueChange?: (value: ValueChangeDetails<unknown>) => void;
	};
	let label = undefined;
	let { options, initial, onValueChange }: Props = $props();
	const selectData = $derived(options);

	const collection = select.collection({
		// svelte-ignore state_referenced_locally
		items: options as Option[],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.label
	});
	$effect(() => {
		collection.items = selectData;
	});

	const [snapshot, send] = useMachine(
		select.machine({
			id: '1',
			collection,
			value: initial ? [initial] : undefined,
			onValueChange
		})
	);
	const api = $derived(select.connect(snapshot, send, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<Toggle {api}></Toggle>

	<div use:portal {...api.getPositionerProps()}>
		<List {api} {selectData}></List>
	</div>
</div>

<style lang="scss">
	.dropdown {
		background-color: var(--bg-accent);
	}
</style>
