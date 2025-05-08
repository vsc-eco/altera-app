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
</div>

<style lang="scss">
	[data-part='list'] {
		padding-left: 0.5rem;
		display: flex;
	}

	[data-part='trigger'] {
        background: none;
        border: none;
        font: inherit;
        padding: 0;
        margin: 0rem 0.25rem;

        span {
            text-wrap: nowrap;
            display: flex;
            height: 2.5rem;
            box-sizing: border-box;
            align-items: center;
            margin-bottom: 0.25rem;
            padding: 1rem;
            box-sizing: border-box;
            border-radius: 0.25rem;
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
            border-bottom: 0.2rem solid var(--primary-fg-mid);
        }
	}
</style>
