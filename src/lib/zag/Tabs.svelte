<script lang="ts">
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { untrack, type Snippet } from 'svelte';
	import { getUniqueId } from './idgen';
	type Props = {
		items: {
			value: string;
			label: string;
			disabled?: boolean;
			content: () => ReturnType<Snippet>;
		}[];
		defaultValue?: string;
		activeTab?: string | null;
	};
	let { items, activeTab = $bindable(), defaultValue }: Props = $props();

	const id = getUniqueId();
	const service = useMachine(tabs.machine, {
		id,
		defaultValue: untrack(() => defaultValue ?? items[0].value)
	});

	const api = $derived(tabs.connect(service, normalizeProps));
	$effect(() => {
		activeTab = api.value;
	});
</script>

<div {...api.getRootProps()}>
	<div {...api.getListProps()}>
		{#each items as item}
			<button {...api.getTriggerProps({ value: item.value, disabled: item.disabled ?? false })}>
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
		display: flex;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	[data-part='trigger'] {
		background: none;
		border: none;
		font-family: 'Nunito Sans', sans-serif;
		font: inherit;
		padding: 0;
		margin: 0rem 0.25rem;
		border-bottom: 1.5px solid transparent;
		cursor: pointer;
		transform: translate(0, 1px);

		span {
			text-wrap: nowrap;
			display: flex;
			box-sizing: border-box;
			align-items: center;
			margin-bottom: 0.5rem;
			padding: 0.5rem 1rem;
			border-radius: 12px;
			color: var(--dash-text-secondary);
			text-decoration: none;
			transition: transform 0.05s;

			&:hover {
				background-color: rgba(255, 255, 255, 0.06);
				color: var(--dash-text-primary);
			}
			&:active {
				background-color: rgba(255, 255, 255, 0.08);
				color: var(--dash-text-primary);
				transform: scale(0.99);
			}
		}

		&[data-selected] {
			span {
				background-color: rgba(111, 106, 248, 0.1);
				color: var(--dash-text-primary);
			}
			border-color: #6F6AF8;
		}

		&:hover {
			border-color: #6F6AF8;
		}
	}
</style>
