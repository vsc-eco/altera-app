<script lang="ts" generics="Option extends {label: string}">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { Check } from 'lucide-svelte';
	import type { Api } from '@zag-js/select';
	import type { PropTypes } from '@zag-js/svelte';
	type Props = {
		api: Api<PropTypes, any>;
		selectData: Option[];
	};
	let { api, selectData } = $props();
</script>

<ul {...api.getContentProps()}>
	{#each selectData as item}
		<li {...api.getItemProps({ item })}>
			<span {...api.getItemTextProps({ item })}>{item.label}</span>
			<span class="check" {...api.getItemIndicatorProps({ item })}>
				<Check></Check>
			</span>
		</li>
	{/each}
</ul>

<style lang="scss">
	ul {
		border-radius: 0.25rem;
		background-color: var(--neutral-bg-accent);
		width: 160px;
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
	.check :global(svg) {
		max-height: 16px;
		max-width: 16px;
	}
</style>
