<script lang="ts">
	import RadioGroup from './zag/RadioGroup.svelte';
	let fromCoin: string | undefined = $state();
	let fromNetwork: string | undefined = $state();
	// let fromNetwork: string | undefined = $state();
	import swapOptions from './swapOptions';
	const fromCoinItems = swapOptions.from.coins.map((v) => {
		return {
			icon: v.coin.icon,
			value: v.coin.value,
			label: v.coin.label,
			snippet: radioLabel
		};
	});
	let fromNetworks = $derived(
		swapOptions.from.coins.find((v) => v.coin.value == fromCoin)?.networks
	);
	let fromNetworkItems = fromNetworks?.map((v) => {
		return {
			icon: v.icon,
			value: v.value,
			label: v.label,
			snippet: radioLabel
		};
	});
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<h2>From:</h2>
<RadioGroup name="Coin:" bind:value={fromCoin} items={fromCoinItems}></RadioGroup>
{#if fromNetworks}
	<RadioGroup name="Network:" bind:value={fromNetwork} items={fromNetworkItems}></RadioGroup>
{/if}
