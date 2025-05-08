<script lang="ts">
	import { getUniqueId } from '$lib/zag/idgen';
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import WithdrawModal from './WithdrawModal.svelte';
	import DepositModal from './DepositModal.svelte';
	import Card from '$lib/cards/Card.svelte';

	const data = [
		{ value: 'stake', label: 'Stake', content: `<DepositModal/>` },
		{ value: 'unstake', label: 'Unstake', component: `<WithdrawModal/>` }
	];

	const id = $props.id();
	const service = useMachine(tabs.machine, {
		id: getUniqueId(),
		defaultValue: 'stake'
	});

	const api = $derived(tabs.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<div {...api.getListProps()}>
		{#each data as item}
			<button {...api.getTriggerProps({ value: item.value })}>
				<p>{item.label}</p>
			</button>
		{/each}
		<div {...api.getIndicatorProps()}></div>
	</div>
	{#each data as item}
		<div {...api.getContentProps({ value: item.value })}>
			{#if item.value === 'stake'}
				<DepositModal />
			{:else if item.value === 'unstake'}
				<WithdrawModal />
			{/if}
		</div>
	{/each}
</div>

<style lang="scss">
	[data-part='list'] {
		padding-left: 0.5rem;
		display: flex;
	}

	[data-part='trigger'] {
		display: inline-flex;
		justify-content: center;
		cursor: pointer;
		--height: 2.5rem;
		box-sizing: border-box;
		height: var(--height);
		font: inherit;
		border: none;
		padding: 0.25rem 0.75rem;
		align-items: center;
		transition: transform 0.05s;

		background: none;
		color: var(--fg-accent-shifted);
		&:hover {
			background: linear-gradient(
				to top,
				color-mix(in srgb, var(--primary-fg-mid), transparent 70%),
				transparent 80%
			);
			color: var(--fg-accent);
			border-bottom: 0.25rem solid color-mix(in srgb, var(--primary-fg-mid), transparent 70%);
		}

		&[data-selected] {
			border-bottom: 0.25rem solid var(--primary-fg-mid);
			color: var(--primary-fg-mid);
		}
	}
</style>
