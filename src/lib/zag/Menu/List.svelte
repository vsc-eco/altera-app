<script lang="ts">
	let { api, selectData } = $props();
</script>

<ul {...api.getContentProps()}>
	{#each selectData as item}
		<li {...api.getItemProps({ value: item.label })}>
			<span {...api.getItemTextProps({ value: item.label })}>
				{#if typeof item.snippet == 'function'}
					{@const Snippet = item.snippet}
					{@render Snippet(item.snippetData)}
				{:else}
					{item.label}
				{/if}
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
	span {
		display: flex;
		align-items: center;
		justify-content: start;
	}
</style>
