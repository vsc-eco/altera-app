<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';
	type Props = {
		api: Api<PropTypes, unknown>;
		def: string;
		disabled?: boolean;
		items?: any[];
		styleType?: 'default' | 'card';
	};
	let { api, def, disabled, items, styleType = 'default' }: Props = $props();
	const triggerProps: ButtonAttributes = $derived(api.getTriggerProps()) as ButtonAttributes;
	let open = $derived(api.open);
	let currentItem: any | undefined = $derived(
		items?.find((item) => item.label === api.valueAsString)
	);
	console.log('toggle style type', styleType);
</script>

<div {...api.getControlProps()}>
	{#if styleType === 'default'}
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
	{:else}
		<Card>
			<button {...triggerProps}>
				<div class="content">
					{#if typeof currentItem?.snippet == 'function'}
						{@const Snippet = currentItem.snippet}
						{@render Snippet(currentItem.snippetData)}
					{:else}
						{api.valueAsString || def || 'Select option'}
					{/if}
				</div>
				<span class="arrow">
					{#if open}
						<ChevronUp></ChevronUp>
					{:else}
						<ChevronDown></ChevronDown>
					{/if}
				</span>
			</button>
		</Card>
	{/if}
</div>

<style lang="scss">
	button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: auto;
		min-height: 4rem;
		width: 100%;
		display: flex;
		border: none;
		background: none;
		&:hover {
			cursor: pointer;
		}
		font: inherit;
	}
</style>
