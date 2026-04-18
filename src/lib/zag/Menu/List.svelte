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
		border-radius: 16px;
		background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
		backdrop-filter: blur(10px);
		border: 1px solid var(--dash-card-border);
		padding: 0.25rem;
		box-shadow: var(--dash-card-shadow);
	}
	li {
		border-radius: 12px;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		font-family: 'Nunito Sans', sans-serif;
		color: var(--dash-text-primary);
	}
	li[data-highlighted] {
		background-color: rgba(111, 106, 248, 0.1);
	}
	span {
		display: flex;
		align-items: center;
		justify-content: start;
	}
</style>
