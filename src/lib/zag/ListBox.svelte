<script lang="ts">
	import * as listbox from '@zag-js/listbox';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { createFilter } from '@zag-js/i18n-utils';
	import { getUniqueId } from './idgen';
	import { ChevronDown, ChevronRight, Search } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { slide } from 'svelte/transition';

	type Option = { label: string; [key: string]: any };

	let {
		items,
		input = true,
		value = $bindable(),
		placeholder
	}: {
		items: Option[];
		input?: boolean;
		value: string | undefined;
		placeholder?: string;
	} = $props();

	const filter = createFilter({ sensitivity: 'base' });
	let search = $state('');

	function filterDisabled(options: Option[]): Option[] {
		// First, check if there are any non-disabled items
		const hasNonDisabledItems = options.some((item) => !item.disabled);
		if (!hasNonDisabledItems) return options;
		return options.filter((item) => {
			if (item.value === search) {
				return true;
			}
			return !item.disabled;
		});
	}

	const collection = $derived.by(() => {
		const searchOptions = items.filter((item) => filter.contains(item.label, search));
		const options = filterDisabled(searchOptions);
		return listbox.collection({
			items: options,
			itemToValue: (item) => item.value ?? item.label,
			itemToString: (item) => item.label,
			isItemDisabled: (item) => item.disabled
		});
	});

	const service = useMachine(listbox.machine, {
		id: getUniqueId(),
		get collection() {
			return collection;
		},
		onValueChange(details) {
			value = details.value[0];
		}
	});

	const api = $derived(listbox.connect(service, normalizeProps));

	let detailsShowing: Option | undefined = $state();
	function toggleShowing(item: Option) {
		if (detailsShowing?.value === item.value || detailsShowing?.label === item.label) {
			detailsShowing = undefined;
		} else {
			detailsShowing = item;
		}
	}
</script>

<div {...api.getRootProps()}>
	<label {...api.getLabelProps()}><Search aria-label="Search" /></label>
	{#if input}
		<input {...api.getInputProps({ autoHighlight: true })} bind:value={search} />
	{/if}
	<ul {...api.getContentProps()}>
		{#each collection.items as item (item.value ?? item.label)}
			<li {...api.getItemProps({ item })}>
				{#if item.snippet}
					{@render item.snippet(item.snippetData ?? item)}
				{:else}
					{item.label}
				{/if}
				{#if item.details && !item.disabled}
					<PillButton onclick={() => toggleShowing(item)} styleType="icon-subtle">
						{#if detailsShowing && (detailsShowing.label === item.label || detailsShowing.value === item.value)}
							<ChevronDown />
						{:else}
							<ChevronRight />
						{/if}
					</PillButton>
				{/if}
			</li>
			{#if detailsShowing && (detailsShowing.label === item.label || detailsShowing.value === item.value)}
				<div class="details-wrapper" transition:slide={{ duration: 300 }}>
					{@render item.details(item.snippetData ?? item)}
				</div>
			{/if}
		{/each}
	</ul>
</div>

<style lang="scss">
	[data-part='root'] {
		position: relative;
		width: 100%;
	}
	[data-part='label'] {
		color: var(--neutral-bg-mid);
		left: 0.25rem;
		aspect-ratio: 1;
		pointer-events: none;
		display: flex;
		align-items: center;
		position: absolute;
		top: 0;
		:global(svg),
		:global(img) {
			width: 16px;
			height: 16px;
			padding: 4px 0;
			aspect-ratio: 1;
		}
	}
	[data-part='input'] {
		width: 100%;
		box-sizing: border-box;
		padding-left: 0.5rem;
		padding-left: calc(16px + 0.75rem);
	}
	[data-part='trigger'] {
		display: none;
	}
	[data-part='content'] {
		margin-top: 1rem;
	}
	[data-part='item'] {
		border-radius: 0.5rem;
		cursor: pointer;
		padding: 0.5rem;
		display: flex;
		align-items: center;
	}
	[data-part='item'][data-highlighted] {
		background-color: var(--bg-accent);
	}
	[data-part='item'][data-disabled] {
		cursor: default;
	}
	.details-wrapper {
		padding: 0.5rem 1rem;
	}
</style>
