<script lang="ts">
    import { authStore } from "$lib/auth/store";
	import BasicAmountInput from "$lib/currency/BasicAmountInput.svelte";
	import type { SendDetails } from "$lib/send/sendOptions";

    let auth = $authStore;
    let {
		details = $bindable()
	}: {
		details: SendDetails;
	} = $props();

    $effect(() => {
        console.log(details.fromAmount);
    })
</script>

<BasicAmountInput bind:details id={"basic-input"}/>