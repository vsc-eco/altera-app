<script lang="ts">
	import { flattenedItems, getItemFromIndex, haystack } from '$lib/search/items';
	import uFuzzy from '@leeoniya/ufuzzy';
	import { Search } from '@lucide/svelte';
	import * as combobox from '@zag-js/combobox';
	import { useMachine, normalizeProps } from '@zag-js/svelte';

	const comboboxData = flattenedItems;

	let options = $state.raw(comboboxData);
	let fuzzyOpts = {
		intraMode: 1
	};
	let uf = new uFuzzy(fuzzyOpts);

	const collection = combobox.collection({
		items: comboboxData,
		itemToValue: (item) => item.label,
		itemToString: (item) => item.label
	});

	const id = $props.id();
	const service = useMachine(combobox.machine, {
		id,
		collection,
		closeOnSelect: true,
		onOpenChange() {
			options = comboboxData;
		},
		onInputValueChange({ inputValue }) {
			const filtered = uf.filter(haystack, inputValue)?.map(getItemFromIndex) || [];
			const newOptions = filtered.length > 0 ? filtered : comboboxData;

			collection.setItems(newOptions);
			options = newOptions;
		},
		positioning: {
			placement: 'bottom-start',
			gutter: 0,
			flip: false,
			shift: 0
		}
	});
	const api = $derived(combobox.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<label {...api.getLabelProps()}><Search aria-label="Search" /></label>
	<div {...api.getControlProps()}>
		<input {...api.getInputProps()} />
		<button {...api.getTriggerProps()}>▼</button>
	</div>
</div>
<div {...api.getPositionerProps()}>
	{#if options.length > 0}
		<ul {...api.getContentProps()}>
			{#each options as item}
				<li {...api.getItemProps({ item })}>{item.label}</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="scss">
	li {
		padding: 0.5rem;
	}

	[data-part='input'] {
		width: 100%;
		box-sizing: border-box;
		padding-left: calc(16px + 0.75rem);
	}

	[data-part='trigger'] {
		display: none;
	}

	[data-part='root'] {
		position: relative;
		width: 100%;
	}

	[data-part='label'] {
		color: var(--neutral-bg-mid);
		left: 0.5rem;
		aspect-ratio: 1;
		pointer-events: none;
		display: block;
		position: absolute;
		top: calc(50%);
		transform: translateY(-50%);
		:global(svg) {
			width: 16px;
			aspect-ratio: 1;
		}
	}

	[data-part='content'] {
		box-sizing: border-box;
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent);
		z-index: 5 !important;
		padding: 0.5rem;
		border-radius: 0 0 0.5rem 0.5rem;
	}
	[data-part='item'] {
		border-radius: 0.5rem;
		margin-bottom: 0.5rem;
		cursor: pointer;
	}
	[data-part='item'][data-highlighted] {
		background-color: var(--bg-accent);
	}
</style>
