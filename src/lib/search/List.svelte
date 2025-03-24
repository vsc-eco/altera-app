<script lang="ts">
	import uFuzzy from '@leeoniya/ufuzzy';
	import { getItemFromIndex, haystack, flattenedItems } from './items';
	const ops: uFuzzy.Options = {
		intraMode: 1
	};
	type Props = {
		searchTerm: string;
	};
	let { searchTerm }: Props = $props();
	let uf = new uFuzzy(ops);
	let searchedItems = $derived(uf.filter(haystack, searchTerm)?.map(getItemFromIndex));
	let displayedItems = $derived((searchTerm == '' ? flattenedItems : searchedItems)?.slice(0, 10));
</script>

<ul>
	{#if displayedItems && displayedItems.length != 0}
		{#each displayedItems as item}
			<li role="option" aria-selected="false">{item.label}</li>
		{/each}
	{:else}
		<li>No results</li>
	{/if}
</ul>

<style>
	li {
		padding: 0.5rem;
	}
</style>
