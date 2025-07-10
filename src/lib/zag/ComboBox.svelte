<script lang="ts" generics="Option extends {label: string, [key: string]: any}">
	import { ChevronDown, Search } from '@lucide/svelte';
	import * as combobox from '@zag-js/combobox';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { untrack } from 'svelte';

	let {
		items,
		dropdown = false,
		value = $bindable(),
		icon,
		placeholder
	}: {
		items: Option[];
		dropdown?: boolean;
		value: string | undefined;
		icon?: string;
		placeholder?: string;
	} = $props();

	let options = $state.raw(items);

	const collection = $derived(
		combobox.collection({
			items: options,
			itemToValue: (item) => item.value ?? item.label,
			itemToString: (item) => item.label
		})
	);

	const id = $props.id();

	const service = useMachine(combobox.machine, {
		id,
		get collection() {
			return collection;
		},
		onOpenChange() {
			options = items;
		},
		onInputValueChange({ inputValue }) {
			const filtered = items.filter((item) =>
				item.label.toLowerCase().includes(inputValue.toLowerCase())
			);
			const newOptions = filtered.length > 0 ? filtered : items;
			options = newOptions;
		},
		onSelect(details) {
			if (details && details.value.length > 0) {
				value = details.value[0];
				api.setOpen(false);
			}
		},
		positioning: {
			placement: 'bottom-start',
			gutter: 0,
			flip: false,
			shift: 0,
			sameWidth: true
		},
		allowCustomValue: false,
		placeholder: placeholder
	});

	const api = $derived(combobox.connect(service, normalizeProps));
	$effect(() => {
		const val = value;
		if (!val) return;
		untrack(() => {
			if (api.value.length === 0 || val !== api.value[0]) {
				api.setValue([val]);
				const itemWithVal = items.find((item) => item.value && item.value === val);
				if (itemWithVal) {
					api.setInputValue(itemWithVal.label);
				}
			}
		});
	});
</script>

<div {...api.getRootProps()}>
	{#if icon !== undefined}
		<label {...api.getLabelProps()}>
			{#if icon !== '' && api.value.length > 0}
				<img width="16" src={icon} alt="" />
			{:else}
				<Search aria-label="Search" />
			{/if}
		</label>
	{/if}

	<div {...api.getControlProps()}>
		<input {...api.getInputProps()} data-variant={icon !== undefined ? 'icon' : 'simple'} />
		{#if dropdown}
			<button {...api.getTriggerProps()}><ChevronDown /></button>
		{/if}
	</div>
</div>
<div {...api.getPositionerProps()}>
	{#if options.length > 0}
		<ul {...api.getContentProps()}>
			{#each options as item}
				<li {...api.getItemProps({ item })}>
					{#if item.snippet}
						{@render item.snippet(item)}
					{:else}
						{item.label}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
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
	}
	[data-part='input'][data-variant='icon'] {
		padding-left: calc(16px + 0.75rem);
	}
	[data-part='trigger'] {
		display: none;
	}
	[data-part='content'] {
		box-sizing: border-box;
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent-shifted);
		z-index: 5;
		padding: 0.5rem;
		border-radius: 0 0 0.5rem 0.5rem;
		max-height: var(--available-height);
		max-width: var(--available-width);
		overflow: auto;
		border-top: none;
	}
	[data-part='item'] {
		border-radius: 0.5rem;
		cursor: pointer;
	}
	[data-part='item'][data-highlighted] {
		background-color: var(--bg-accent);
	}
	li {
		padding: 0.5rem;
	}
</style>
