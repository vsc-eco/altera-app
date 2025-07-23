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
	let defOpt = $derived(items?.find((item) => (item.value ?? item.lable) === def));
</script>

<div {...api.getControlProps()} class={{ card: styleType === 'card' }}>
	{#if styleType === 'default'}
		<PillButton {...triggerProps} styleType="text" {disabled}>
			{#if typeof currentItem?.snippet == 'function'}
				{@const Snippet = currentItem.snippet}
				{@render Snippet(currentItem.snippetData)}
			{:else if typeof defOpt?.snippet == 'function'}
				{@const Snippet = defOpt.snippet}
				{@render Snippet(defOpt.snippetData)}
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
		<button {...triggerProps} class={{ card: styleType === 'card' }}>
			<div class="content">
				{#if typeof currentItem?.snippet == 'function'}
					{@const Snippet = currentItem.snippet}
					{@render Snippet(currentItem.snippetData)}
				{:else}
					{api.valueAsString || def || 'Select option'}
				{/if}
				<span class="arrow">
					{#if open}
						<ChevronUp></ChevronUp>
					{:else}
						<ChevronDown></ChevronDown>
					{/if}
				</span>
			</div>
		</button>
	{/if}
</div>

<style lang="scss">
	[data-part='control'].card {
		flex-grow: 1;
		display: flex;
	}
	[data-part='trigger'].card {
		position: relative;
		flex-grow: 1;
		display: flex;
		height: auto;
		border: none;
		background: none;
		width: 100%;
		min-height: 4rem;
		padding: 0;
		margin: 0;
		align-items: center;
		justify-content: space-between;
		&:hover {
			cursor: pointer;
		}
		font: inherit;
	}
	.content {
		flex-grow: 1;
		padding: 0.5rem;
		height: auto;
		min-height: 3.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.5rem;
	}
</style>
