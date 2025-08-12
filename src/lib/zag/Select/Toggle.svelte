<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';
	type Props = {
		api: Api<PropTypes, unknown>;
		placeholder: string;
		disabled?: boolean;
		items?: any[];
		styleType?: 'default' | 'card' | 'dropdown';
	};
	let { api, placeholder, disabled, items, styleType = 'default' }: Props = $props();
	const triggerProps: ButtonAttributes = $derived(api.getTriggerProps()) as ButtonAttributes;
	let open = $derived(api.open);
	let currentItem = $derived(items?.find((item) => (item.value ?? item.label) === api.value[0]));
</script>

<div {...api.getControlProps()} class={{ card: styleType !== 'default' }}>
	{#if styleType === 'default'}
		<PillButton {...triggerProps} styleType="text" {disabled}>
			{#if typeof currentItem?.snippet == 'function'}
				{@const Snippet = currentItem.snippet}
				{@render Snippet(currentItem.snippetData ?? currentItem)}
			{:else}
				{api.valueAsString || placeholder || 'Select option'}
			{/if}
			{#if open}
				<ChevronUp></ChevronUp>
			{:else}
				<ChevronDown></ChevronDown>
			{/if}
		</PillButton>
	{:else}
		<button
			{...triggerProps}
			class={['cardlike', { card: styleType === 'card', dropdown: styleType === 'dropdown' }]}
		>
			<div class={['content', { tall: styleType === 'card' }]}>
				{#if typeof currentItem?.snippet == 'function'}
					{@const Snippet = currentItem.snippet}
					{@render Snippet(currentItem.snippetData ?? currentItem)}
				{:else}
					{api.valueAsString || placeholder || 'Select option'}
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
	[data-part='trigger'] {
		font: inherit;
		color: var(--neutral-fg);
		.arrow {
			padding-left: 0.5rem;
		}
	}
	[data-part='trigger'].cardlike {
		position: relative;
		flex-grow: 1;
		display: flex;
		height: auto;
	}
	[data-part='trigger'].card {
		border: none;
		background: none;
		width: 100%;
		padding: 0rem;
		margin: 0;
		align-items: center;
		justify-content: space-between;
		&:hover {
			cursor: pointer;
		}
	}
	[data-part='trigger'].dropdown {
		border: 1px solid var(--neutral-bg-accent-shifted);
		background-color: var(--neutral-off-bg);
		border-radius: 0.5rem;
		&[data-state='open'] {
			box-shadow: 0 -1px inset var(--primary-bg-mid);
			border-bottom-color: var(--primary-bg-mid);
			outline: none;
			border-radius: 0.5rem 0.5rem 0 0;
		}
	}
	.content {
		flex-grow: 1;
		padding: 0.5rem;
		height: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
</style>
