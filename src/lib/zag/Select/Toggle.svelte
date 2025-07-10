<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';
	import type { Snippet } from 'svelte';
	type Props = {
		api: Api<PropTypes, unknown>;
		def: string;
		disabled?: boolean;
		items?: any[];
	};
	let { api, def, disabled, items }: Props = $props();
	const triggerProps: ButtonAttributes = $derived(api.getTriggerProps()) as ButtonAttributes;
	let open = $derived(api.open);
	let currentItem: any | undefined = $derived(
		items?.find((item) => item.label === api.valueAsString)
	);
</script>

<div {...api.getControlProps()}>
	<PillButton {...triggerProps} styleType="text" {disabled}>
		{#if typeof currentItem?.snippet == 'function'}
			{@const Snippet = currentItem.snippet}
			{@render Snippet(currentItem.snippetData)}
		{:else}
			{api.valueAsString || def || 'Select option'}
		{/if}
		{#if open}
			<ChevronUp></ChevronUp>
		{:else}
			<ChevronDown></ChevronDown>
		{/if}
	</PillButton>
</div>
