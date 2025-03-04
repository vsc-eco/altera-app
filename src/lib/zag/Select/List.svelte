<script lang="ts">
	import { Check } from '@lucide/svelte';

	let { api, selectData } = $props();
</script>

<ul {...api.getContentProps()}>
	{#each selectData as item}
		<li {...api.getItemProps({ item })}>
			<span {...api.getItemTextProps({ item })}>
				{#if typeof item.snippet == 'function'}
					{@const Snippet = item.snippet}
					{@render Snippet(item.snippetData)}
				{:else}
					{item.label}
				{/if}
			</span>
			<span class="check" {...api.getItemIndicatorProps({ item })}>
				<Check></Check>
			</span>
		</li>
	{/each}
</ul>

<style lang="scss">
	ul {
		border-radius: 0.25rem;
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		// width: 160px;
		padding: 0.25rem;
	}
	li {
		border-radius: 0.25rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
	}
	li[data-highlighted] {
		background-color: var(--bg-accent);
	}
	.check {
		margin-left: 0.25rem;
	}
	.check :global(.lucide) {
		max-height: 16px;
		max-width: 16px;
	}
</style>
