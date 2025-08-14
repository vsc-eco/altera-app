<script lang="ts">
	import * as listbox from '@zag-js/listbox';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { createFilter } from '@zag-js/i18n-utils';
	import { getUniqueId } from './idgen';
	import { Check, ChevronDown, ChevronRight, Search } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { slide } from 'svelte/transition';
	import EditButton from '$lib/components/EditButton.svelte';

	type Option = { label: string; [key: string]: any };

	let {
		items,
		input = true,
		value = $bindable(),
		label,
		showSelected = false,
		customFilter
	}: {
		items: Option[];
		input?: boolean;
		value: string | undefined;
		label?: string;
		showSelected?: boolean;
		customFilter?: (opts: Option[]) => Option[];
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
		const searchOptions = customFilter
			? customFilter(items)
			: items.filter((item) => filter.contains(item.label, search));
		const options = filterDisabled(searchOptions);
		return listbox.collection({
			items: options,
			itemToValue: (item) => item.value ?? item.label,
			itemToString: (item) => item.label,
			isItemDisabled: (item) => item.disabled
		});
	});

	const machineId = getUniqueId();
	const service = useMachine(listbox.machine, {
		id: machineId,
		get collection() {
			return collection;
		},
		get value() {
			return value ? [value] : [];
		},
		onValueChange(details) {
			value = details.value[0];
		}
	});

	const api = $derived(listbox.connect(service, normalizeProps));

	let detailsShowing: Option | undefined = $state();
	function toggleShowing(item: Option) {
		if (isOpen(item)) {
			detailsShowing = undefined;
		} else {
			detailsShowing = item;
		}
	}
	function isOpen(item: Option) {
		return (
			(detailsShowing?.value && detailsShowing?.value === item.value) ||
			(detailsShowing?.label && detailsShowing?.label === item.label)
		);
	}
</script>

{#if detailsShowing}
	<div class="details-wrapper" transition:slide={{ duration: 300 }}>
		{@render detailsShowing.details(detailsShowing.snippetData ?? detailsShowing)}
	</div>
{:else}
	<div {...api.getRootProps()}>
		{#if label}
			<label {...api.getLabelProps()}>{label}</label>
		{/if}
		{#if input}
			<label for={`list-${machineId}`} class="search-icon"><Search aria-label="Search" /></label>
			<input
				{...api.getInputProps({ autoHighlight: true })}
				bind:value={search}
				id={`list-${machineId}`}
			/>
		{/if}

		<ul {...api.getContentProps()} tabindex="-1" class="listbox-ul">
			{#each collection.items as item (item.value ?? item.label)}
				<li {...api.getItemProps({ item })}>
					{#if item.snippet}
						{@render item.snippet(item.snippetData ?? item)}
					{:else}
						{item.label}
					{/if}
					{#if (item.details || item.edit) && !item.disabled}
						{@const editFunc = () => (item.details ? toggleShowing(item) : item.edit(item))}
						{#if item.details || item.buttonType === 'Chevron'}
							<PillButton onclick={editFunc} styleType="text-subtle">
								<ChevronRight />
							</PillButton>
						{:else}
							<EditButton
								onclick={(e) => {
									e.stopPropagation();
									editFunc();
								}}
							/>
						{/if}
					{:else if showSelected}
						<span {...api.getItemIndicatorProps({ item })}><Check size="16" /></span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style lang="scss">
	[data-part='root'] {
		position: relative;
		width: 100%;
	}
	.search-icon {
		color: var(--neutral-bg-mid);
		left: 0.25rem;
		aspect-ratio: 1;
		pointer-events: none;
		display: flex;
		align-items: center;
		position: absolute;
		top: 0;
		margin: 0.5rem 0 0.5rem 0.25rem;
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
		margin-bottom: 1rem;
	}
	[data-part='trigger'] {
		display: none;
	}
	// [data-part='content'] {

	// }
	[data-part='item'] {
		border-radius: 0.5rem;
		cursor: pointer;
		padding: 0.5rem;
		display: flex;
		align-items: center;
	}
	[data-part='item'][data-highlighted],
	[data-part='item']:hover {
		background-color: var(--bg-accent);
	}
	[data-part='item'][data-selected] {
		background-color: var(--green-bg-accent);
	}
	[data-part='item'][data-disabled] {
		cursor: default;
	}
	[data-part='item-indicator'] {
		margin-left: auto;
	}
	.details-wrapper {
		padding: 0.5rem 1rem;
	}
</style>
