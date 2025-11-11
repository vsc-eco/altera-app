<script lang="ts" generics="Option extends { label: string, [key: string]: any }">
	import * as listbox from '@zag-js/listbox';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { createFilter } from '@zag-js/i18n-utils';
	import { ArrowLeft, Search } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';

	type Props = {
		items: Option[];
		selected: Option | undefined;
		close: () => void;
	};

	let { items, selected = $bindable(), close }: Props = $props();

	let value = $state(selected?.value ?? '');

	const filter = createFilter({ sensitivity: 'base' });
	let search = $state('');

	const collection = $derived.by(() => {
		const options = items.filter((item) => filter.contains(item.label + item.value, search));
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
</script>

<div {...api.getRootProps()}>
	<PillButton onclick={close} styleType="icon-subtle">
		<ArrowLeft size={32} />
	</PillButton>
	<h5>Select a Liquidity Pool</h5>
	<div class="search">
		<label for={`list-search-${machineId}`} class="search-icon">
			<Search aria-label="Search" />
		</label>
		<input
			{...api.getInputProps({ autoHighlight: true })}
			bind:value={search}
			id={`list-search-${machineId}`}
		/>
	</div>

	<ul {...api.getContentProps()} tabindex="-1" class="listbox-ul">
		{#each collection as item}
			<li
				{...api.getItemProps({ item })}
				onclick={() => {
					selected = item;
					close();
				}}
			>
				{#if item.snippet}
					{@render item.snippet(item.snippetData ?? item)}
				{:else if item.component}
					{@const Component = item.component}
					<Component {item} />
				{:else}
					{item.label}
				{/if}
			</li>
		{/each}
	</ul>

	{#if collection.size === 0}
		<div class="sm-caption no-balance">No liquidity pools found matching these parameters.</div>
	{/if}
</div>

<style lang="scss">
	[data-part='root'] {
		position: relative;
		width: 100%;
	}
	.search {
		position: relative;
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
	.listbox-group-header {
		padding-top: 0.5rem;
	}
	.no-balance {
		text-align: center;
	}
</style>
