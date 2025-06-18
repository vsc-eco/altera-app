<script lang="ts">
    import type { Auth } from '$lib/auth/store';
	import Dialog from '$lib/zag/Dialog.svelte';
    import StakeHbdModal from './StakeHBDModal.svelte';
    import Tabs from '$lib/zag/Tabs.svelte';
    let {
        dialogOpen = $bindable(),
        toggle = $bindable()
    } = $props<{
        auth: Auth;
        dialogOpen: boolean;
        toggle: (open?: boolean) => void;
    }>();

    const tabData = [
		{ value: 'stake', label: 'Stake', content: stake },
		{ value: 'unstake', label: 'Unstake', content: unstake }
	];
</script>
{#snippet stake()}
	<StakeHbdModal type="stake"/>
{/snippet}
{#snippet unstake()}
	<StakeHbdModal type="unstake"/>
{/snippet}

<Dialog bind:toggle bind:open={dialogOpen}>
    <!-- {#snippet title()}
        <h1>Stake HBD</h1>
    {/snippet} -->
    {#snippet content()}
        <Tabs items={tabData}/>
    {/snippet}
</Dialog>