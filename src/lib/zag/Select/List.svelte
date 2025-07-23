<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';

	type Props = {
		api: Api<PropTypes, unknown>;
		selectData: any[];
		styleType?: 'default' | 'card';
	};
	let { api, selectData, styleType = 'default' }: Props = $props();
</script>

<ul {...api.getContentProps()} class={{ card: styleType === 'card' }}>
	<div class={['content-spacing', { card: styleType === 'card' }]}>
		{#each selectData as item}
			<li {...api.getItemProps({ item })} class={{ card: styleType === 'card' }}>
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
	</div>
</ul>

<style lang="scss">
	[data-part='content'] {
		border-radius: 0.25rem;
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		// width: 160px;
		// padding: 0.25rem;
		padding: 0.5rem;
		z-index: 10;
	}
	[data-part='content'].card {
		box-sizing: border-box;
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent-shifted);
		z-index: 5;
		border-radius: 0 0 0.5rem 0.5rem;
		max-height: var(--available-height);
		max-width: var(--available-width);
		overflow: auto;
		border-top: none;
	}
	[data-part='item'] {
		border-radius: 0.25rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		min-height: 32px;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
	}
	[data-part='item'].card {
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		height: 3rem;
	}
	[data-part='item'][data-highlighted] {
		background-color: var(--bg-accent);
	}
	.content-spacing.card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.check {
		margin-left: 0.25rem;
	}
	.check :global(.lucide) {
		max-height: 16px;
		max-width: 16px;
	}
</style>
