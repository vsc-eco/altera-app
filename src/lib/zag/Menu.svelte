<script lang="ts">
	import * as menu from '@zag-js/menu';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import Toggle from './Menu/Toggle.svelte';

	const [snapshot, send] = useMachine(menu.machine({ id: '1' }));
	let { label } = $props();

	const api = $derived(menu.connect(snapshot, send, normalizeProps));
</script>

<div>
	<Toggle {api} def={label || 'asdf'}></Toggle>
	<div use:portal {...api.getPositionerProps()}>
		<ul {...api.getContentProps()}>
			<li {...api.getItemProps({ value: 'edit' })}>Edit</li>
			<li {...api.getItemProps({ value: 'duplicate' })}>Duplicate</li>
			<li {...api.getItemProps({ value: 'delete' })}>Delete</li>
			<li {...api.getItemProps({ value: 'export' })}>Export...</li>
		</ul>
	</div>
</div>
