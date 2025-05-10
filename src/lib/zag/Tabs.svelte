<script lang="ts">
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import type { Snippet } from 'svelte';
	import { getUniqueId } from './idgen';
	type Props = {
		items: { value: string; label: string; content: Snippet }[];
		defaultValue?: string;
		activeTab?: string | null;
	};
	let { items, activeTab = $bindable(), defaultValue }: Props = $props();

	const id = getUniqueId();
	const service = useMachine(tabs.machine, {
		id,
		defaultValue: defaultValue ?? items[0].value
	});

	const api = $derived(tabs.connect(service, normalizeProps));
	$effect(() => {
		activeTab = api.value;
	});
</script>

<div {...api.getRootProps()}>
	<div {...api.getListProps()}>
		{#each items as item}
			<button {...api.getTriggerProps({ value: item.value })}>
				<span>
					<p>{item.label}</p>
				</span>
			</button>
		{/each}
		<div {...api.getIndicatorProps()}></div>
	</div>
	{#each items as item}
		<div {...api.getContentProps({ value: item.value })}>
			{@render item.content()}
		</div>
	{/each}
</div>

<style lang="scss">
	[data-part='list'] {
		// padding-left: 0.5rem;
		display: flex;
		border-bottom: 1px solid var(--neutral-bg-accent);
	}

	[data-part='trigger'] {
		background: none;
		border: none;
		font: inherit;
		padding: 0;
		margin: 0rem 0.25rem;
		border-bottom: 1.5px solid transparent;
		cursor: pointer;
		// makes sure that the colored line is on top of the grey line
		transform: translate(0, 1px);

		span {
			text-wrap: nowrap;
			display: flex;
			box-sizing: border-box;
			align-items: center;
			margin-bottom: 0.5rem;
			padding: 0.5rem 1rem;
			box-sizing: border-box;
			border-radius: 0.5rem;
			color: var(--neutral-fg);
			text-decoration: none;
			transition: transform 0.05s;

			&:hover {
				background-color: var(--neutral-bg-accent);
				color: var(--primary-fg-accent);
			}
			&:active {
				background-color: var(--neutral-bg-accent);
				color: var(--primary-fg-accent-shifted);
				transform: scale(0.99);
			}
		}

		&[data-selected] {
			span {
				background-color: var(--neutral-bg-accent);
				color: var(--primary-fg-accent-shifted);
			}
			border-color: var(--primary-bg-mid);
		}

		&:hover {
			border-color: var(--primary-mid);
		}
	}
</style>
