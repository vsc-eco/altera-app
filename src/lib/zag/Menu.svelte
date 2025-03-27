<script lang="ts">
	import * as menu from '@zag-js/menu';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import Toggle from './Menu/Toggle.svelte';
	import List from './Menu/List.svelte';
	import { getUniqueId } from './idgen';
	import type { Snippet } from 'svelte';
	import IconToggle from './Menu/IconToggle.svelte';
	type Props = {
		label: string;
		items: unknown;
		onSelect?: (details: menu.SelectionDetails) => void;
		styleType?: 'outline' | 'icon';
		children?: Snippet;
	};
	let { label, items, onSelect, styleType, children }: Props = $props();
	const service = useMachine(menu.machine, {
		id: getUniqueId(),
		onSelect
	});

	const api = $derived(menu.connect(service, normalizeProps));
</script>

<div>
	{#if styleType == 'icon' && children}
		<IconToggle {api} def={label}>{@render children()}</IconToggle>
	{:else}
		<Toggle {api} def={label}></Toggle>
	{/if}
	<div use:portal {...api.getPositionerProps()}>
		<List {api} selectData={items}></List>
	</div>
</div>
