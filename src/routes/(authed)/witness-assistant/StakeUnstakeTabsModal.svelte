<script lang="ts">
    import { getUniqueId } from '$lib/zag/idgen';
	import * as tabs from "@zag-js/tabs";
  	import { useMachine, normalizeProps } from "@zag-js/svelte";
	import WithdrawModal from './WithdrawModal.svelte';
    import DepositModal from './DepositModal.svelte';
    import Card from '$lib/cards/Card.svelte';

    const data = [
		{ value: "stake", label: "Stake", content: `<DepositModal/>` },
		{ value: "unstake", label: "Unstake", component: `<WithdrawModal/>` },
	];

	const id = $props.id();
	const service = useMachine(tabs.machine as any, {
		id: getUniqueId(),
		defaultValue: "stake",
	});

	const api = $derived(tabs.connect(service as any, normalizeProps));
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
            {#if item.value === "stake"}
                <DepositModal/>
            {:else if item.value === "unstake"}
                <WithdrawModal/>
            {/if}
        </div>
    {/each}
</div>

<style lang="scss">
	button {
		display: inline-flex;
		justify-content: center;
		cursor: pointer;
		--height: 2.5rem;
		box-sizing: border-box;
		height: var(--height);
		color: inherit;
		font: inherit;
		border: none;
		padding: 0.25rem 0.75rem;
		box-sizing: border-box;
		display: inline-flex;
		gap: 0.125rem;
		align-items: center;
		text-decoration: none;
		vertical-align: middle;
		position: relative;
		white-space: nowrap; /* keep on same line */
		transition: transform 0.05s;

        background: none;
		color: var(--fg-accent-shifted);    
		&:hover {
			background: linear-gradient(to bottom, var(/*TODO*/), #6366f1);
			color: var(--fg-accent);
		}
	}
    [data-part="trigger"][data-state="active"] {
        border-bottom: var(/*TODO*/);
    }
</style>