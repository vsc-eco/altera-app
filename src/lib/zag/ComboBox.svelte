<script lang="ts">
	import { ChevronDown, ChevronUp, Search } from '@lucide/svelte';
	import * as combobox from '@zag-js/combobox';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { untrack, type Snippet } from 'svelte';
	import { getUniqueId } from './idgen';
	import type { FocusEventHandler } from 'svelte/elements';
	import type { ImgIconOption } from '$lib/components/ImageIconRenderer.svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';

	type Option = { label: string; [key: string]: any };

	let {
		items,
		dropdown = false,
		value = $bindable(),
		onBlur,
		icon,
		placeholder,
		createPlaceholder,
		// results must have label and value fields
		getSuggestions,
		custom = false,
		label,
		preferValue = false
	}: {
		items: Option[];
		dropdown?: boolean;
		value: string | undefined;
		onBlur?: FocusEventHandler<HTMLInputElement> | null | undefined;
		icon?: ImgIconOption;
		placeholder?: string;
		createPlaceholder?: (value: string) => any;
		getSuggestions?: (value: string) => Promise<any[]>;
		custom?: boolean;
		label?: string | ((...args: any[]) => ReturnType<Snippet>);
		preferValue?: boolean;
	} = $props();

	let inputValue = $state<string>();
	let options = $state.raw(items);

	function onParamChange(val: string) {
		if (val === '') {
			options = items.filter((item) => !item.disabled);
			return;
		}
		const filtered = items.filter(
			(item) =>
				item.addresses === undefined &&
				(item.label.toLowerCase().includes(val.toLowerCase()) ||
					item.value?.toLowerCase().includes(val.toLowerCase()))
		);
		if (custom) {
			const currentlyInput = createPlaceholder
				? createPlaceholder(val)
				: { label: val, value: val };
			// const newOptions: Option[] = [currentlyInput, ...(filtered.length > 0 ? filtered : items)];
			const newOptions: Option[] = filtered.find(
				(item) => item.label === currentlyInput.label || item.value === currentlyInput.value
			)
				? filtered
				: [currentlyInput, ...filtered];
			if (getSuggestions && !val?.startsWith('0x')) {
				const currentValue = val;
				getSuggestions(currentValue).then((itms) => {
					if (api.inputValue !== currentValue) return;
					const all = [...newOptions, ...itms];
					options = all.reduce((acc: Option[], current) => {
						const exists = acc.find((item) => item.value === current.value);
						if (!exists) {
							const inItems = items.find((item) => item.value === current.value);
							acc.push(inItems ?? current);
						}
						return acc;
					}, []);
				});
			} else {
				options = newOptions;
			}
		} else {
			options = filtered;
		}
	}
	function onDefocus() {
		if (custom) {
			const val = items.find((item) => item.label === api.inputValue)?.value ?? api.inputValue;
			if (value !== val) value = val;
		}
	}

	function toPreferredString(item: Option | undefined) {
		if (!item) return undefined;
		if (preferValue) {
			return item.value ?? item.label;
		} else {
			return item.label;
		}
	}

	const collection = $derived(
		combobox.collection({
			items: options,
			itemToValue: (item) => item.value ?? item.label,
			itemToString: toPreferredString
		})
	);

	// $inspect(value, inputValue);

	const service = useMachine(combobox.machine, {
		id: getUniqueId(),
		get collection() {
			return collection;
		},
		get value() {
			return value ? [value] : [];
		},
		get inputValue() {
			if (inputValue !== undefined) return inputValue;
			const entry = items.find((item) => value && (item.value ?? item.label) === value);
			if (entry) return toPreferredString(entry);
			return value;
		},
		onOpenChange(details) {
			if (details.open) onParamChange(inputValue ?? '');
		},
		onInputValueChange({ inputValue: val }) {
			inputValue = val;
			onParamChange(val);
		},
		onValueChange(details) {
			if (value !== details.value[0]) value = details.value[0];
		},
		onFocusOutside: onDefocus,
		onPointerDownOutside: onDefocus,
		onInteractOutside: onDefocus,
		positioning: {
			placement: 'bottom-start',
			gutter: 0,
			flip: false,
			shift: 0,
			sameWidth: true
		},
		allowCustomValue: custom,
		placeholder: placeholder
	});

	const api = $derived(combobox.connect(service, normalizeProps));
	$effect(() => {
		if (value && options.find((opt) => opt.value === value)?.disabled) {
			value = undefined;
		}
	});
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			onDefocus();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<div {...api.getRootProps()}>
	{#if icon !== undefined || label}
		<label {...api.getLabelProps()} data-variant={label ? '' : 'icon-only'}>
			{#if icon !== undefined}
				<span class="icon-label">
					<ImageIconRenderer {icon} />
				</span>
			{/if}
			{#if typeof label === 'string'}
				{label}
			{:else if typeof label === 'function'}
				{@render label()}
			{/if}
		</label>
	{/if}

	<div {...api.getControlProps()}>
		<input
			{...api.getInputProps()}
			data-variant={icon !== undefined ? 'icon' : 'simple'}
			onblur={(e) => {
				onDefocus();
				api.setOpen(false);
				if (onBlur) onBlur(e);
			}}
		/>
		{#if dropdown}
			<button {...api.getTriggerProps()}>
				{#if api.open}
					<ChevronUp />
				{:else}
					<ChevronDown />
				{/if}
			</button>
		{/if}
	</div>
</div>
<div {...api.getPositionerProps()}>
	{#if options.length > 0}
		<ul {...api.getContentProps()}>
			{#each options as item}
				<li {...api.getItemProps({ item })}>
					{#if item.snippet}
						{@render item.snippet(item.snippetData ?? item)}
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
		.icon-label {
			color: var(--neutral-bg-mid);
			aspect-ratio: 1;
			pointer-events: none;
			display: flex;
			align-items: center;
			position: absolute;
			top: 1.25rem;
			left: 0.25rem;
			margin: 0.5rem 0 0.5rem 0.25rem;
			:global(svg),
			:global(img) {
				width: 16px;
				height: 16px;
				padding: 4px 0;
				aspect-ratio: 1;
			}
		}
		&[data-variant='icon-only'] {
			margin: 0;
			.icon-label {
				top: 0;
			}
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
		position: absolute;
		display: flex;
		align-items: center;
		height: 100%;
		border: none;
		background-color: transparent;
		cursor: pointer;
		top: 0;
		right: 0.5rem;
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
		padding: 0.5rem;
	}
	[data-part='item'][data-highlighted] {
		background-color: var(--bg-accent);
	}
	[data-part='item'][data-disabled] {
		cursor: default;
	}
</style>
