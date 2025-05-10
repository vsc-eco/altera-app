<script lang="ts">
	import { getUniqueId } from '$lib/zag/idgen';
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import WithdrawModal from './WithdrawModal.svelte';
	import DepositModal from './DepositModal.svelte';
	import Card from '$lib/cards/Card.svelte';
	import Tabs from '$lib/zag/Tabs.svelte';

	const data = [
		{ value: 'stake', label: 'Stake', content: deposit },
		{ value: 'unstake', label: 'Unstake', content: withdraw }
	];

	const id = $props.id();
	const service = useMachine(tabs.machine, {
		id: getUniqueId(),
		defaultValue: 'stake'
	});

	const api = $derived(tabs.connect(service, normalizeProps));
</script>

{#snippet deposit()}
	<DepositModal></DepositModal>
{/snippet}
{#snippet withdraw()}
	<WithdrawModal></WithdrawModal>
{/snippet}

<Card>
	<Tabs items={data}></Tabs>
	<!-- <div {...api.getRootProps()}>
		<div {...api.getListProps()}>
			{#each data as item}
				<button {...api.getTriggerProps({ value: item.value })}>
					<span>
						<p>{item.label}</p>
					</span>
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
	</div> -->
</Card>

<style lang="scss">
	[data-part='list'] {
		// padding-left: 0.5rem;
		margin-top: 0.25rem;
		transform: translate(0, -0.5rem);
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

		span {
			text-wrap: nowrap;
			display: flex;
			box-sizing: border-box;
			align-items: center;
			margin-bottom: 0.35rem;
			padding: 0.5rem 1rem;
			box-sizing: border-box;
			border-radius: 0.5rem;
			color: var(--neutral-fg);
			text-decoration: none;
			transition: transform 0.05s;
			cursor: pointer;

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
			border-color: var(--primary-fg-mid);
		}

		&:hover {
			border-color: var(--primary-fg-accent);
		}
	}
</style>
