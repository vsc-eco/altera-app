<script lang="ts">
    import type { SharedProps } from '$lib/PillButton.svelte';
    import PillBtn from '$lib/PillButton.svelte';
    import StakePopup from '$lib/vscTransactions/hive/vscOperations/StakePopup.svelte';
    import { Component, Layers2 } from '@lucide/svelte';
    import { actions, type NavigationAction } from "../quickActions";
    import type { Auth } from '$lib/auth/store';
    let { auth } : {auth: Auth} = $props();
    type PopupAction = {
        type: 'popup';
        label: string;
        onclick: () => void;
        icon: typeof Component;
        styling?: SharedProps;
    }
    let dialogOpen = $state(false);
    let toggle = $state((open?: boolean) => {
        dialogOpen = open !== undefined ? open : !dialogOpen;
    });
    function openPopup() {
        toggle(true);
    }
    const menuActions: (NavigationAction | PopupAction)[] = [
        ...actions,
        {
            type: 'popup',
            label: 'Staking',
            onclick: openPopup,
            icon: Layers2
        }
    ];
</script>

<div class="action-bar">
	{#each menuActions as action}
		<PillBtn 
            {...'styling' in action ? action.styling : {}}
            {...'href' in action ? { href: action.href } : { onclick: action.onclick }}
        >
			{@const Icon = action.icon}
			<Icon />
			{action.label}
		</PillBtn>
	{/each}
</div>
<StakePopup
    auth = {auth}
    bind:dialogOpen={dialogOpen}
    bind:toggle={toggle}
/>

<style>
    .action-bar {
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		height: 3.5rem;
		white-space: nowrap;
		position: relative;
	}
	.action-bar::after {
		content: '';
		position: sticky;
		display: block;
		left: calc(100% - 32px);
		bottom: 0;
		width: 32px;
		height: 3rem;
		background: linear-gradient(90deg, transparent, var(--neutral-bg));
	}
</style>