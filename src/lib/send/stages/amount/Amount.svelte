<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import { Coin, networkMap, type SendDetails } from '$lib/send/sendOptions';
	import { getMethodNetworks } from '$lib/send/sendUtils';
	import Select from '$lib/zag/Select.svelte';

	let auth = $authStore;
	let {
		details = $bindable()
	}: {
		details: SendDetails;
	} = $props();

	$effect(() => {
		console.log(details.fromAmount);
	});

    const networkOptions = $derived(details.method ? getMethodNetworks(details.method) : []);
    const assetOptions = $derived.by(() => {
        let result: Coin[] = [];
        for (const net of networkOptions) {
            const coins = networkMap.get(net);
            if (coins) {
                result.push(...coins);
            }
        }
        return result;
    })
</script>
<!-- 
{#snippet accountCard()}
    
{/snippet} -->

<h2>Amount</h2>
<h3>Recipient Gets</h3>
<BasicAmountInput bind:details id={'basic-input'} />

<h3>Asset</h3>

<h3>Send From</h3>
<!-- <Select items={}/> -->

<style lang="scss">
	h3 {
		margin-top: 2rem;
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
</style>
