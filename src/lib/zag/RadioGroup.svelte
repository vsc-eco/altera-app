<script
	lang="ts"
	generics="Item extends {
			label?: string, 
			snippet?: Snippet<[Item]>; 
			value: string, 
			disabled?: boolean 
		}"
>
	import * as radio from '@zag-js/radio-group';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	import { Check } from '@lucide/svelte';
	import { untrack, type Snippet } from 'svelte';

	type Props = {
		required?: boolean;
		id?: string;
		items: Item[];
		name: string;
		value?: string | null;
		defaultValue?: string;
	};
	let {
		id,
		name,
		items,
		value = $bindable(),
		defaultValue: propDefault,
		required
	}: Props = $props();
	let generatedId = getUniqueId();
	console.log(generatedId);
	let enabled = items.filter((item) => !item.disabled);
	let defaultValue = enabled.length == 1 ? enabled[0].value : propDefault;
	let error = $state('');
	const service = useMachine(radio.machine, {
		id: id ?? generatedId,
		name,
		orientation: 'horizontal',
		defaultValue: defaultValue
	});
	const api = $derived(radio.connect(service, normalizeProps));
	$effect(() => {
		if (enabled.length == 1) {
			api.setValue(enabled[0].value);
		}
	});
	$effect(() => {
		value = api.value;
		if (value != null && items.find((item) => item.value == value)?.disabled === true) {
			api.clearValue();
		}
	});
</script>

<div {...api.getRootProps()}>
	<h3 {...api.getLabelProps()}>{name}</h3>
	<div class="items">
		{#each items as opt}
			<label
				{...api.getItemProps({
					value: opt.value,
					disabled: opt.disabled === undefined ? false : opt.disabled
				})}
			>
				<span
					{...api.getItemTextProps({
						value: opt.value,
						disabled: opt.disabled === undefined ? false : opt.disabled
					})}
				>
					{#if opt.snippet}
						{@render opt.snippet(opt)}
					{:else}
						{opt.label}
					{/if}
				</span>
				<input
					oninvalid={(e) => {
						e.preventDefault();
						error = e.currentTarget.validationMessage;
					}}
					oninput={() => {
						error = '';
					}}
					{required}
					{...api.getItemHiddenInputProps({
						value: opt.value,
						disabled: opt.disabled === undefined ? false : opt.disabled
					})}
				/>
				<div
					{...api.getItemControlProps({
						value: opt.value,
						disabled: opt.disabled === undefined ? false : opt.disabled
					})}
				>
					<Check></Check>
				</div>
			</label>
		{/each}
	</div>
	<label class="error" for={id}>
		{#if error}
			{error}
		{:else}
			&nbsp;
		{/if}
	</label>
</div>

<style lang="scss">
	[data-part='item'] {
		padding: 0.25rem 0.75rem;
		margin: 0;
		height: 2.5rem;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: left;
		border: 1px solid var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem;
		cursor: pointer;
		position: relative;
		color: var(--neutral-fg);
		/* styles for radio checked or unchecked state */
	}
	[data-part='item-text'] {
		display: flex;
		gap: 0.5rem;
		width: 100%;
		justify-content: flex-start;
	}
	[data-part='item'][data-focus] {
		/* styles for radio checked or unchecked state */
		/* outline: 2px solid var(--primary-fg-mid);
		outline-offset: 2px; */
		z-index: 1;
		background-color: var(--neutral-bg-accent);
		border: 1px solid var(--neutral-bg-mid);
	}

	[data-part='item'][data-state='checked'] {
		border: 1px solid var(--primary-mid);
		/* styles for radio checked or unchecked state */
	}

	.items {
		display: flex;
		flex-wrap: wrap;
		width: 100%;
		justify-content: flex-start;
		gap: 0.75rem;
		padding-right: 0.5rem;
		box-sizing: border-box;
		/* styles for radio checked or unchecked state */
	}

	.items > * {
		flex-grow: 1;
		min-width: max-content;
		width: 20%;
	}
	[data-part='item'][data-disabled] {
		background-color: var(--neutral-bg-accent);
		color: var(--neutral-fg-mid);
		cursor: default;
		:global(img) {
			filter: grayscale(1);
		}
	}

	[data-part='item'][data-state='checked'][data-focus] {
		background-color: transparent;
	}

	[data-part='item'][data-focus] {
		outline: 2px solid var(--primary-mid);
		outline-offset: 2px;
	}

	[data-part='item-control'][data-state='checked'] {
		/* styles for radio checked or unchecked state */
		position: absolute;
		top: 0;
		right: 0;
		transform: translate(50%, -50%);
		background-color: var(--primary-mid);
		color: var(--neutral-bg);
		border-radius: 50%;
		padding: 0.125rem;
		width: 1rem;
		height: 1rem;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		border: 1px solid var(--primary-mid);
		background-repeat: no-repeat;
	}

	[data-part='item-control'] :global(svg) {
		stroke-width: 4px;
	}

	[data-part='item-control'][data-state='unchecked'] {
		/* styles for radio checked or unchecked state */
		display: none;
	}
	h3 {
		font-size: var(--text-base);
		font-weight: 450;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		margin-left: 0.25rem;
	}
</style>
