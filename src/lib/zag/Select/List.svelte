<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';

	type Props = {
		api: Api<PropTypes, unknown>;
		selectData: any[];
		styleType?: 'default' | 'card' | 'dropdown';
	};
	let { api, selectData, styleType = 'default' }: Props = $props();
</script>

<ul {...api.getContentProps()} class={{ card: styleType !== 'default' }}>
	<div class={['content-spacing', { card: styleType === 'card' }]}>
		{#each selectData as item}
			<li
				{...api.getItemProps({ item })}
				class={{ card: styleType === 'card', dropdown: styleType === 'dropdown' }}
			>
				<span {...api.getItemTextProps({ item })} class={{ dropdown: styleType === 'dropdown' }}>
					{#if typeof item.snippet == 'function'}
						{@const Snippet = item.snippet}
						{@render Snippet(item.snippetData ?? item)}
					{:else}
						{item.label}
					{/if}
				</span>
				{#if styleType !== 'dropdown'}
					<span class="check" {...api.getItemIndicatorProps({ item })}>
						<Check></Check>
					</span>
				{/if}
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
		overflow: auto;
		border-top: none;
	}
	[data-part='content'][data-placement='top-start'].card {
		border: 1px solid var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem 0.5rem 0 0;
		border-bottom: none;
	}
	[data-part='item'] {
		border-radius: 0.25rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		// min-height: 32px;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
	}
	[data-part='item'][data-disabled] {
		cursor: default;
	}
	[data-part='item'].card {
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		// height: 3rem;
	}
	[data-part='item'].dropdown {
		display: flex;
	}
	[data-part='item-text'].dropdown {
		flex-grow: 1;
		// margin-right: 1rem;
		// &[data-state='unchecked'] {
		// 	margin-right: 2.25rem;
		// }
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
