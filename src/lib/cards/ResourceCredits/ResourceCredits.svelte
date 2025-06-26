<script lang="ts">
    import Card from "../Card.svelte";
    import Progress from "$lib/zag/Progress.svelte";
    import { GetAccountRCStore } from "$houdini";
    import { accountBalance } from "$lib/balances";
</script>

<Card>
    <div class="rc-wrapper">
        <h2>Resource Credits</h2>
        <h5>VSC Resource Credits</h5>
        <Progress boundaries={{min: 0, max: $accountBalance.hbd}} currentValue={$accountBalance.resource_credits}/>
    </div>
</Card>

<style lang="scss">
    .rc-wrapper {
        margin: 1rem;
    }
</style>