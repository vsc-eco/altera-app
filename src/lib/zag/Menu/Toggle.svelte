<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { Api } from '@zag-js/menu';
	import type { PropTypes } from '@zag-js/svelte';
	type Props = {
		api: Api<PropTypes>;
		def: string;
	};
	let { api, def }: Props = $props();
	const triggerProps: ButtonAttributes = $derived(api.getTriggerProps()) as ButtonAttributes;
	let open = $derived(api.open);
</script>

<PillButton {...triggerProps} style="outline">
	{def || 'Actions...'}
	{#if open}
		<ChevronUp></ChevronUp>
	{:else}
		<ChevronDown></ChevronDown>
	{/if}
</PillButton>
