<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';
	import type { MouseEventHandler } from 'svelte/elements';
	type Props = {
		api: Api<PropTypes, unknown>;
		placeholder: string;
		disabled?: boolean;
		items?: any[];
		styleType?: 'default' | 'card' | 'dropdown';
	};
	let { api, placeholder, disabled, items, styleType = 'default' }: Props = $props();
	let currentItem = $derived(items?.find((item) => (item.value ?? item.label) === api.value[0]));
</script>

<div {...api.getControlProps()} class={{ card: styleType !== 'default' }}>
	{#if styleType === 'default'}
		<PillButton {...api.getTriggerProps() as ButtonAttributes} styleType="text" {disabled}>
			{#if typeof currentItem?.snippet === 'function'}
				{@const Snippet = currentItem.snippet}
				{@render Snippet(currentItem.snippetData ?? currentItem)}
			{:else}
				{api.valueAsString || placeholder || 'Select option'}
			{/if}
			{#if api.open}
				<ChevronUp />
			{:else}
				<ChevronDown />
			{/if}
		</PillButton>
	{:else}
		<button
			{...api.getTriggerProps()}
			class={['cardlike', { card: styleType === 'card', dropdown: styleType === 'dropdown' }]}
		>
			<div class={['content', { tall: styleType === 'card' }]}>
				{#if typeof currentItem?.snippet === 'function'}
					<svelte:boundary onerror={() => {}}>
						{@const Snippet = currentItem.snippet}
						{@render Snippet(currentItem?.snippetData ?? currentItem)}
					</svelte:boundary>
				{:else}
					{api.valueAsString || placeholder || 'Select option'}
				{/if}
				<span class="arrow">
					{#if api.open}
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
		font-family: 'Nunito Sans', sans-serif;
		font: inherit;
		color: var(--dash-text-primary);
		.arrow {
			padding-left: 0.5rem;
		}
		cursor: pointer;
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
		border: 1px solid rgba(255, 255, 255, 0.08);
		background-color: rgba(0, 0, 0, 0.25);
		border-radius: 12px;
		color: var(--dash-text-primary);
		&[data-state='open'][data-placement='bottom-start'] {
			box-shadow: 0 -1px inset #6F6AF8;
			border-bottom-color: #6F6AF8;
			outline: none;
			border-radius: 12px 12px 0 0;
		}
		&[data-state='open'][data-placement='top-start'] {
			box-shadow: 0 1px inset #6F6AF8;
			border-top-color: #6F6AF8;
			outline: none;
			border-radius: 0 0 12px 12px;
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
