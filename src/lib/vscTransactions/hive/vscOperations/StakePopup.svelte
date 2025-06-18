<script lang="ts">
    import type { Auth } from '$lib/auth/store';
	import Dialog from '$lib/zag/Dialog.svelte';
    import type { CoinOnNetwork } from '$lib/send/sendOptions';
    import { getHbdStakeOp, getHbdUnstakeOp } from './stake';
    let {
        auth,
        dialogOpen = $bindable(),
        toggle = $bindable()
    } = $props<{
        auth: Auth;
        dialogOpen: boolean;
        toggle: (open?: boolean) => void;
    }>();
</script>
<Dialog bind:toggle bind:open={dialogOpen}>
    {#snippet title()}
        Stake HBD
    {/snippet}
    {#snippet content()}
        <p>Temp</p>
    {/snippet}
</Dialog>