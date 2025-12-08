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
		autofocusInput?: boolean;
	};

	function normalizeString(str: string): string {
		return str
			.replace(/[^a-zA-Z0-9]+/g, ' ') // treat _, -, multiple spaces, etc. as one space
			.trim();
	}

	let itemRefs: Record<string, HTMLElement | null> = {};

	function setItemRef(key: string, el: HTMLElement | null) {
		if (el) itemRefs[key] = el;
		else delete itemRefs[key];
	}

	function itemRefAction(node: HTMLElement, key: string) {
		itemEls.set(key, node);
		return {
			destroy() {
				itemEls.delete(key);
			}
		};
	}

	let { items, value, clickAsset, type = 'asset', autofocusInput = false }: Props = $props();

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

	// KEYBOARD NAV =============
	let contentEl: HTMLElement | null = null;
	let inputEl = $state<HTMLInputElement | null>(null);

	const itemsFlat = $derived.by(() => {
		const flat: Option[] = [];
		for (const [, groupItems] of groupedItems) {
			for (const it of groupItems) flat.push(it);
		}
		return flat;
	});

	let highlightedIndex = $state(0);
	const itemEls = new Map<string, HTMLElement>();

	function setHighlighted(i: number) {
		const flat = itemsFlat;
		if (!flat.length) return;

		let n = i % flat.length;
		if (n < 0) n += flat.length;

		highlightedIndex = n;

		const value = flat[n]?.value ?? flat[n]?.label;
		const el = itemEls.get(value);
		if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	$effect(() => {
		if (!itemsFlat.length) return;

		if (!value) {
			highlightedIndex = 0;
			return;
		}

		const idx = itemsFlat.findIndex((it) => (it.value ?? it.label) === value);
		if (idx >= 0) highlightedIndex = idx;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (!itemsFlat.length) return;

		// Allow keyboard navigation when the component is active
		if (e.key === 'ArrowDown') {
			setHighlighted(highlightedIndex + 1);
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			setHighlighted(highlightedIndex - 1);
			e.preventDefault();
		} else if (e.key === 'Enter') {
			const sel = itemsFlat[highlightedIndex];
			if (sel && !sel.disabled) clickAsset(sel.value ?? sel.label);
			e.preventDefault();
		}
	}

	$effect(() => {
		if (inputEl) {
			inputEl.addEventListener('keydown', handleKeydown);
			if (autofocusInput) {
				inputEl.focus();
			}
			return () => inputEl!.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div {...api.getRootProps()} tabindex="0">
	{#if type !== 'network'}
		<label for={`list-search-${machineId}`} class="search-icon"
			><Search aria-label="Search" /></label
		>
		<input
			bind:this={inputEl}
			{...api.getInputProps({ autoHighlight: true })}
			bind:value={search}
			id={`list-search-${machineId}`}
		/>
	{/if}

	<ul {...api.getContentProps()} tabindex="-1" class="listbox-ul" bind:this={contentEl}>
		{#each groupedItems as [groupName, groupItems]}
			{#if type === 'balance'}
				<li class="listbox-group-header">
					<h6>
						Balance on {Object.values(Network).find((net) => net.value === groupName)?.label}
					</h6>
				</li>
			{/if}
			{#each groupItems as item (item.value ?? item.label)}
				{#key item.value ?? item.label}
					<!-- LOCAL REF ONLY FOR THIS ITEM -->
					<li
						{...api.getItemProps({ item })}
						onclick={item.disabled ? undefined : () => clickAsset(item.value)}
						use:itemRefAction={item.value ?? item.label}
						class:selected={(itemsFlat[highlightedIndex]?.value ?? itemsFlat[highlightedIndex]?.label) === (item.value ?? item.label)}
					>
						{#if item.snippet}
							{@render item.snippet(item.snippetData ?? item)}
						{:else}
							{item.label}
						{/if}

						{#if !item.disabled && type === 'asset'}
							<div class="icons"><ChevronRight /></div>
						{/if}
					</li>
				{/key}
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
			&:hover,
			&.selected {
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
	.listbox-group-header {
		padding-top: 0.5rem;
	}
	.no-balance {
		text-align: center;
	}
</style>
