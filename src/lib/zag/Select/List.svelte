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

<ul {...api.getContentProps()} class={{ card: styleType !== 'default', dropdown: styleType === 'dropdown' }}>
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
		border-radius: 16px;
		background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
		backdrop-filter: blur(10px);
		border: 1px solid var(--dash-card-border);
		padding: 0.5rem;
		z-index: 10;
		box-shadow: var(--dash-card-shadow);
	}
	[data-part='content'].card {
		box-sizing: border-box;
		background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
		backdrop-filter: blur(10px);
		border: 1px solid var(--dash-card-border);
		z-index: 5;
		border-radius: 0 0 16px 16px;
		overflow: auto;
		border-top: none;
	}
	[data-part='content'].dropdown {
		max-height: 16rem;
		overflow-y: auto;
		overflow-x: visible;
	}
	[data-part='content'][data-placement='top-start'].card {
		border: 1px solid var(--dash-card-border);
		border-radius: 16px 16px 0 0;
		border-bottom: none;
	}
	[data-part='item'] {
		border-radius: 12px;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		font-family: 'Nunito Sans', sans-serif;
		color: var(--dash-text-primary);
	}
	[data-part='item'][data-disabled] {
		cursor: default;
		color: var(--dash-text-muted);
	}
	[data-part='item'].card {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	[data-part='item'].dropdown {
		display: flex;
	}
	[data-part='item-text'].dropdown {
		flex-grow: 1;
	}
	[data-part='item'][data-highlighted] {
		background-color: rgba(111, 106, 248, 0.1);
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
