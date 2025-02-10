<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';
	type Props = {
		api: Api<PropTypes, any>;
	};
	let { api } = $props();
	const triggerProps: ButtonAttributes = $derived(api.getTriggerProps()) as ButtonAttributes;
	let open = $derived(api.open);
</script>

<div {...api.getControlProps()}>
	<PillButton {...triggerProps} style="text">
		{api.valueAsString || 'Select option'}
		{#if open}
			<ChevronUp></ChevronUp>
		{:else}
			<ChevronDown></ChevronDown>
		{/if}
	</PillButton>
</div>
