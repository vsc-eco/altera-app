<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import { Coin, Network, networkMap, type CoinOptions, type SendDetails } from '$lib/send/sendOptions';
	import { getMethodNetworks } from '$lib/send/sendUtils';
	import Select from '$lib/zag/Select.svelte';
	import { optimism } from 'viem/chains';
	import AssetInfo from '../AssetInfo.svelte';

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
    const assetOptions: CoinOptions['coins'] = $derived.by(() => {
        let result: CoinOptions['coins'] = [];
        for (const net of networkOptions) {
            const coins = networkMap.get(net);
			if (!coins) continue;
            for (const coin of coins) {
				const entry = result.find(item => item.coin.value === coin.value);
				if (entry) {
					if (entry.networks.find(item => item.value === net.value)) continue;
					entry.networks.push(net);
				} else {
					result.push({coin: coin, networks: [net]});
				}
			}
        }
		console.log("assetOptions", result);
        return result;
    });
	const assetObjs = $derived(assetOptions.map(opt => ({
		...opt.coin,
		snippet: assetCard,
		snippetData: {fromCoin: opt.coin}
	})));
</script>

{#snippet assetCard(fromCoin: CoinOptions['coins'][number] | undefined)}
	{#if fromCoin}
    	<AssetInfo coinOpt={fromCoin}/>
	{/if}
{/snippet}

<h2>Amount</h2>
<h3>Recipient Gets</h3>
<BasicAmountInput bind:details id={'basic-input'} />

<h3>Asset</h3>

<h3>Send From</h3>
<Select items={assetObjs}/>

<style lang="scss">
	h3 {
		margin-top: 2rem;
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
</style>
