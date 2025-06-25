<script lang="ts">
    import Card from "../Card.svelte";
    import Progress from "$lib/zag/Progress.svelte";
    import { GetAccountRCStore } from "$houdini";

    let api = $derived(new GetAccountRCStore());
    let rcs = $derived($api.data?.getAccountRC ?? 0);

</script>

<Card>
    <h2>Resource Credits</h2>
    <Progress boundaries={{min: 0, max: 100}} currentValue={50}/>
</Card>