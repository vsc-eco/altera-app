<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import type { Auth } from '$lib/auth/store';
	import { isMac } from '../../isMac';
	import { flattenedItems, getItemFromIndex, haystack } from '$lib/Topbar/search/items';
	import uFuzzy from '@leeoniya/ufuzzy';
	import { Search } from '@lucide/svelte';
	import * as combobox from '@zag-js/combobox';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { untrack } from 'svelte';
	import PillButton from '$lib/PillButton.svelte';

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

	const id = 'search';
	let openSearch = $state(false);
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
		inputBehavior: 'autohighlight',
		positioning: {
			placement: 'bottom-start',
			gutter: 0,
			flip: false,
			shift: 0,
			sameWidth: true
		},
		selectionBehavior: 'clear',
		onValueChange() {
			openSearch = false;
			api.setOpen(false);
		}
	});
	let input: HTMLInputElement | undefined = $state();
	const api = $derived(combobox.connect(service, normalizeProps));
	let selected = $derived(api.selectedItems[0]);
	let auth: Auth | undefined = $state();
	$effect(() => {
		const unsub = authStore.subscribe((v) => {
			auth = v;
		});
		return unsub;
	});
	$effect(() => {
		const untrackedAuth: Auth | undefined = untrack(() => auth);
		if (selected && untrackedAuth?.value) {
			$inspect(selected);
			selected.action({ auth: untrackedAuth });
		}
	});
</script>

<svelte:document
	onkeydown={(e) => {
		if ((e.metaKey || e.ctrlKey) && e.key == 'k') {
			e.preventDefault();
			openSearch = true;
			e.stopPropagation();
			api.setOpen(true);
			return false;
		}
	}}
	onkeyup={(e) => {
		if ((e.metaKey || e.ctrlKey) && e.key == 'k') {
			e.preventDefault();
			openSearch = true;
			e.stopPropagation();
			api.setOpen(true);

			return false;
		}
	}}
/>

<div {...api.getRootProps()} class={{ openSearch }}>
	<label {...api.getLabelProps()}><Search aria-label="Search" /></label>
	<div {...api.getControlProps()}>
		<input
			onfocus={() => api.setOpen(true)}
			bind:this={input}
			onblur={() => {
				openSearch = false;
			}}
			{...api.getInputProps()}
		/>
		<button {...api.getTriggerProps()}>▼</button>
	</div>
	<span class="overlay key-prompt">
		<key>
			{#if isMac == 'unk'}
				&nbsp;
			{:else if isMac}
				⌘
			{:else}
				ctrl
			{/if}
		</key>
		<key>K</key>
	</span>
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
<span class="searchBtn">
	<PillButton
		onclick={() => {
			openSearch = true;
			api.setOpen(true);
		}}
		styleType="icon"><Search /></PillButton
	>
</span>

<style lang="scss">
	.searchBtn {
		display: none;
	}
	[data-part='root'] {
		position: relative;
		width: 100%;
	}
	.key-prompt {
		position: absolute;
		top: calc(50%);
		transform: translateY(-50%);
		right: 0.5rem;
		display: inline-flex;
		gap: 0.125rem;
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
	@media screen and (max-width: 420px) {
		[data-part='root'] {
			// display: none;
			position: fixed;
			background-color: var(--neutral-bg);
			left: 0;
			width: 100%;
			box-sizing: border-box;
			padding: 0.5rem;
			z-index: 5;
			display: none;
		}
		[data-part='root'].openSearch {
			display: block;
		}
		.key-prompt {
			display: none;
		}
		[data-part='label'] {
			left: 1rem;
		}
		.searchBtn {
			display: block;
		}
	}
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

	[data-part='content'] {
		box-sizing: border-box;
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent-shifted);
		z-index: 5 !important;
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
</style>
