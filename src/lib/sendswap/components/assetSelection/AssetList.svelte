<script lang="ts" generics="Option extends { label: string, [key: string]: any }">
	import * as listbox from '@zag-js/listbox';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { createFilter } from '@zag-js/i18n-utils';
	import { ChevronRight, Search } from '@lucide/svelte';
	import { Network } from '$lib/sendswap/utils/sendOptions';

	type Props = {
		items: Option[];
		value: string | undefined;
		clickAsset: (assetValue: string) => void;
		type?: 'asset' | 'network' | 'balance';
	};

	function normalizeString(str: string): string {
		return str
			.replace(/[^a-zA-Z0-9]+/g, ' ') // treat _, -, multiple spaces, etc. as one space
			.trim();
	}

	let { items, value, clickAsset, type = 'asset' }: Props = $props();

	const filter = createFilter({ sensitivity: 'base' });
	let search = $state('');

	const collection = $derived.by(() => {
		const options = items.filter((item) =>
			filter.contains(item.label + normalizeString(item.value), search.trim())
		);
		// const options = filterDisabled(searchOptions);
		return listbox.collection({
			items: options,
			itemToValue: (item) => item.value ?? item.label,
			itemToString: (item) => item.label,
			isItemDisabled: (item) => !!item.disabled
		});
	});

	const machineId = $props.id();
	const service = useMachine(listbox.machine, {
		id: machineId,
		get collection() {
			return collection;
		},
		get value() {
			return value ? [value] : undefined;
		},
		onSelect(details) {
			clickAsset(details.value);
		}
	});

	const api = $derived(listbox.connect(service, normalizeProps));

	const groupedItems = $derived.by(() => {
		const groups = new Map<string, Option[]>();

		if (collection.items.length > 0) {
			collection.items.forEach((item) => {
				const value = item.value ?? item.label;
				const parts = value.split(':');
				const groupKey = parts.length > 1 ? parts[1] : 'ungrouped';

				if (!groups.has(groupKey)) {
					groups.set(groupKey, []);
				}
				groups.get(groupKey)!.push(item);
			});
		}

		// Convert to array of [groupName, items] pairs
		return Array.from(groups.entries());
	});

	var ul = $state<HTMLUListElement>();
	$effect(() => {
		if (!ul) return;
		ul.addEventListener('focus', () => {
			if (ul?.matches(':focus-visible') && !api.highlightedValue) {
				const firstValue = api.collection.firstValue;
				if (firstValue) {
					api.highlightValue(firstValue);
				}
			}
		});
		ul.addEventListener('mouseover', (e) => {
			const target = e.target as HTMLElement;
			// if (target.closest('.real-item')) {
			// 	ul?.classList.add('hovering-item');
			// }
			if (api.highlightedValue && target.closest('.real-item')) {
				api.clearHighlightedValue();
			}
		});

		// ul.addEventListener('mouseout', (e) => {
		// 	const target = e.target as HTMLElement;
		// 	const relatedTarget = e.relatedTarget as HTMLElement;

		// 	// Only remove if we're not moving to another li
		// 	if (target.closest('.real-item') && !relatedTarget?.closest('.real-item')) {
		// 		ul?.classList.remove('hovering-item');
		// 	}
		// });
	});
</script>

<div {...api.getRootProps()}>
	{#if type !== 'network'}
		<label for={`list-search-${machineId}`} class="search-icon"
			><Search aria-label="Search" /></label
		>
		<input
			{...api.getInputProps({ autoHighlight: true })}
			bind:value={search}
			id={`list-search-${machineId}`}
		/>
	{/if}

	<ul {...api.getContentProps()} class="listbox-ul" bind:this={ul}>
		{#each groupedItems as [groupName, groupItems]}
			{#if type === 'balance'}
				<li class="listbox-group-header">
					<h6>
						Balance on {Object.values(Network).find((net) => net.value === groupName)?.label}
					</h6>
				</li>
			{/if}
			{#each groupItems as item (item.value ?? item.label)}
				<li {...api.getItemProps({ item })} class="real-item">
					{#if item.snippet}
						{@render item.snippet(item.snippetData ?? item)}
					{:else}
						{item.label}
					{/if}
					{#if !item.disabled && type === 'asset'}
						<div class="icons">
							<ChevronRight />
						</div>
					{/if}
				</li>
			{/each}
		{/each}
	</ul>

	{#if groupedItems.length === 0}
		<div class="sm-caption no-balance">
			No balance found on your account. Please make a deposit to get started.
		</div>
	{/if}
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
		border-radius: 0.5rem;
		&:focus-visible {
			outline: none;
			z-index: inherit;
		}
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
			&[data-selected] {
				background-color: var(--quaternary-bg-accent-shifted);
				&[data-highlighted],
				&:hover {
					background-color: var(--quaternary-bg-mid);
				}
			}
		}
		[data-part='item'][data-disabled] {
			cursor: default;
		}
		// &.hovering-item {
		// 	[data-part='item']:not([data-disabled]):not(:hover) {
		// 		&[data-highlighted] {
		// 			background-color: inherit;
		// 			&[data-selected] {
		// 				background-color: var(--quaternary-bg-mid);
		// 			}
		// 		}
		// 	}
		// }
	}

	[data-part='item-indicator'] {
		margin-left: auto;
	}
	.details-wrapper {
		padding: 0.5rem 1rem;
	}
	.listbox-group-header {
		padding-top: 0.5rem;
	}
	.no-balance {
		text-align: center;
	}
</style>
