<script lang="ts">
	import * as radio from '@zag-js/radio-group';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	export type Item = { label: string; value: string };
	type Props = {
		id?: string;
		items: Item[];
		name: string;
		value?: string | null;
	};
	let { id, name, items, value = $bindable() }: Props = $props();
	const service = useMachine(radio.machine, {
		id: id ?? getUniqueId(),
		name,
		orientation: 'horizontal'
	});
	const api = $derived(radio.connect(service, normalizeProps));
	$effect(() => {
		value = api.value;
	});
</script>

<div {...api.getRootProps()}>
	<h3 {...api.getLabelProps()}>{name}</h3>
	<div class="items">
		{#each items as opt}
			<label {...api.getItemProps({ value: opt.value })}>
				<span {...api.getItemTextProps({ value: opt.value })}>{opt.label}</span>
				<input {...api.getItemHiddenInputProps({ value: opt.value })} />
				<div {...api.getItemControlProps({ value: opt.value })}></div>
			</label>
		{/each}
	</div>
</div>

<style>
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
		/* styles for radio checked or unchecked state */
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
		justify-content: flex-start;
		gap: 0.25rem;
		/* styles for radio checked or unchecked state */
	}

	[data-part='radio-label'][data-state='checked|unchecked'] {
		/* styles for radio checked or unchecked state */
		padding: 0;
	}
	h3 {
		font-size: var(--text-sm);
		margin-top: 0.5rem;
		margin-bottom: 0.25rem;
	}
</style>
