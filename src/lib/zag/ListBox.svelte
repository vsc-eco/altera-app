<script lang="ts" generics="Option extends { label: string, [key: string]: any }">
	import * as listbox from '@zag-js/listbox';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { createFilter } from '@zag-js/i18n-utils';
	import { getUniqueId } from './idgen';
	import { Check, Search } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';

	type Props = {
		items: Option[];
		input?: boolean;
		value?: string;
		label?: string;
		showSelected?: boolean;
		disabled?: boolean;
		customFilter?: (opts: Option[], search: string) => Option[];
	};

	let {
		items,
		input = true,
		value = $bindable(),
		label,
		showSelected = false,
		disabled = false,
		customFilter
	}: Props = $props();

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
			? customFilter(items, search)
			: items.filter((item) => filter.contains(item.label, search));
		// const options = filterDisabled(searchOptions);
		const options = searchOptions;
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
			if (disabled) return;
			if (details.value.length === 0) {
				api.clearHighlightedValue();
			}
			value = details.value[0];
		},
		deselectable: true
	});

	const api = $derived(listbox.connect(service, normalizeProps));
</script>

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

	<ul {...api.getContentProps()} tabindex="-1" class={['listbox-ul', { disabled }]}>
		{#each collection.items as item (item.value ?? item.label)}
			<li {...api.getItemProps({ item })}>
				{#if item.snippet}
					{@render item.snippet(item.snippetData ?? item)}
				{:else}
					{item.label}
				{/if}
				<div class="icons">
					{#if item.icons && !item.disabled}
						{#each item.icons as iconInfo}
							{@const func = iconInfo.action ?? (() => {})}
							<PillButton onclick={func} styleType="icon-subtle">
								<ImageIconRenderer icon={iconInfo.icon} color={iconInfo.color} />
							</PillButton>
						{/each}
					{:else if showSelected}
						<span {...api.getItemIndicatorProps({ item })}><Check size="16" /></span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</div>

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
	[data-part='content']:focus-visible {
		outline: none;
		z-index: inherit;
	}
	[data-part='input'] {
		width: 100%;
		box-sizing: border-box;
		padding-left: 0.5rem;
		padding-left: calc(16px + 0.75rem);
		margin-bottom: 1rem;
	}
	[data-part='input'][data-state='open'] {
		box-shadow: 0 -1px inset var(--primary-bg-mid);
		border-bottom-color: var(--primary-bg-mid);
		outline: none;
		border-radius: 0.5rem 0.5rem 0 0;
	}
	[data-part='trigger'] {
		display: none;
	}
	// [data-part='content'] {

	// }
	[data-part='item'] {
		border-radius: 0.5rem;
		padding: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		.icons {
			display: flex;
			gap: 0.25rem;
		}
	}
	[data-part='content']:not(.disabled) {
		[data-part='item'] {
			cursor: pointer;
		}
		[data-part='item']:not([data-disabled]) {
			&[data-highlighted],
			&:hover {
				background-color: var(--highlighted-bg);
				.custom-icon.hover {
					visibility: visible;
				}
			}
			&[data-part='item'][data-selected] {
				background-color: var(--quaternary-bg-accent-shifted);
			}
		}
		[data-part='item'][data-disabled] {
			cursor: default;
		}
	}

	[data-part='item-indicator'] {
		margin-left: auto;
	}
	.details-wrapper {
		padding: 0.5rem 1rem;
	}
</style>
