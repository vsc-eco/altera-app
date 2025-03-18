<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { Api } from '@zag-js/menu';
	import type { PropTypes } from '@zag-js/svelte';
	import type { Snippet } from 'svelte';
	type Props = {
		api: Api<PropTypes>;
		def: string;
		children: Snippet;
	};
	let { api, def, children }: Props = $props();
	const triggerProps: ButtonAttributes = $derived(api.getTriggerProps()) as ButtonAttributes;
	let open = $derived(api.open);
</script>

<PillButton {...triggerProps} styleType="icon">
	{@render children()}
</PillButton>
