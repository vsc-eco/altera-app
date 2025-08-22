<script lang="ts" generics="Option extends { label: string, [key: string]: any }">
	import { ChevronDown, ChevronUp, Search } from '@lucide/svelte';
	import * as combobox from '@zag-js/combobox';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { untrack, type Snippet } from 'svelte';
	import { getUniqueId } from './idgen';
	import type { ImgIconOption } from '$lib/components/ImageIconRenderer.svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';

	let {
		items,
		dropdown = false,
		value = $bindable(),
		onBlur,
		icon,
		placeholder,
		custom = false,
		label,
		preferValue = false,
		createPlaceholder,
		// results must have label and value fields
		getSuggestions,
		customFilter
	}: {
		items: Option[];
		dropdown?: boolean;
		value: string | undefined;
		onBlur?: ((e?: FocusEvent) => any) | null | undefined;
		icon?: ImgIconOption;
		placeholder?: string;
		custom?: boolean;
		label?: string | ((...args: any[]) => ReturnType<Snippet>);
		preferValue?: boolean;
		createPlaceholder?: (value: string) => any;
		getSuggestions?: (value: string) => Promise<any[]>;
		customFilter?: (opts: Option[], search: string, find?: boolean) => Option[];
	} = $props();

	let inputValue = $state<string>();
	let options = $state.raw(items);
	let open = $state.raw(false);

	function toPreferredString(item: Option | undefined) {
		if (!item) return undefined;
		if (preferValue) {
			return item.value ?? item.label;
		} else {
			return item.label;
		}
	}

	function safeCompare(a: Option, b: Option) {
		return (
			(a.value && b.value && a.value.toLowerCase() === b.value.toLowerCase()) ||
			a.label.toLowerCase() === b.label.toLowerCase()
		);
	}

	function onParamChange(val: string) {
		if (val === '') {
			options = items.filter((item) => !item.disabled).slice(0, 4);
			return;
		}
		const filtered = customFilter
			? customFilter(items, val)
			: items.filter(
					(item) =>
						item.label.toLowerCase().includes(val.toLowerCase()) ||
						item.value?.toLowerCase().includes(val.toLowerCase())
				);
		if (custom) {
			const currentlyInput = createPlaceholder
				? createPlaceholder(val)
				: { label: val, value: val };
			// const newOptions: Option[] = [currentlyInput, ...(filtered.length > 0 ? filtered : items)];
			const newOptions: Option[] = (
				(
					customFilter
						? customFilter(filtered, currentlyInput.value ?? currentlyInput.label, true).length > 0
						: filtered.find((item) => safeCompare(item, currentlyInput))
				)
					? filtered
					: [currentlyInput, ...filtered]
			).slice(0, 4);
			if (getSuggestions) {
				const currentValue = val;
				getSuggestions(currentValue).then((itms) => {
					if (api.inputValue !== currentValue) return;
					const all = [...newOptions, ...itms];
					options = all.reduce((acc: Option[], current) => {
						const exists = customFilter
							? customFilter(acc, current.value ?? current.label, true).length > 0
							: acc.find((item) => safeCompare(item, current));
						if (!exists) {
							const inItems = customFilter
								? customFilter(items, current.value ?? current.label, true)[0]
								: items.find((item) => safeCompare(item, current));
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
			// if open, allows empty string, otherwise does not
			if ((inputValue !== undefined && open) || inputValue) return inputValue;
			const entry = items.find((item) => value && (item.value ?? item.label) === value);
			if (entry) return toPreferredString(entry);
			return value;
		},
		onOpenChange(details) {
			open = details.open;
			if (details.open) onParamChange(inputValue ?? '');
		},
		onInputValueChange({ inputValue: val }) {
			inputValue = val;
			onParamChange(val);
		},
		onValueChange(details) {
			if (value !== details.value[0]) value = details.value[0];
			if (onBlur) onBlur();
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
		width: auto;
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
	[data-part='input'][data-state='open'] {
		box-shadow: 0 -1px inset var(--primary-bg-mid);
		border-bottom-color: var(--primary-bg-mid);
		outline: none;
		border-radius: 0.5rem 0.5rem 0 0;
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
