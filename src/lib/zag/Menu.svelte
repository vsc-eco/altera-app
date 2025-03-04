<script lang="ts">
	import * as menu from '@zag-js/menu';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import Toggle from './Menu/Toggle.svelte';
	import List from './Menu/List.svelte';
	import { getUniqueId } from './Select/idgen';

	let { label, items, onSelect } = $props();
	const service = useMachine(menu.machine, { id: getUniqueId(), onSelect });

	const api = $derived(menu.connect(service, normalizeProps));
</script>

<div>
	<Toggle {api} def={label}></Toggle>
	<div use:portal {...api.getPositionerProps()}>
		<List {api} selectData={items}></List>
	</div>
</div>
