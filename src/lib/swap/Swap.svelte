<script lang="ts">
	import RadioGroup from '../zag/RadioGroup.svelte';
	let fromCoinValue: string | undefined = $state();

	let fromNetworkValue: string | undefined = $state();
	let toCoinValue: string | undefined = $state();
	let toNetworkValue: string | undefined = $state();
	// let fromNetwork: string | undefined = $state();
	import swapOptions, { Network } from './swapOptions';
	import HiveUsername from '$lib/auth/Username.svelte';
	import { getAuth } from '$lib/auth/store';
	let auth = $derived(getAuth()());
	let fromCoin = $derived(swapOptions.from.coins.find((v) => v.coin.value == fromCoinValue));
	let fromNetworks = $derived(fromCoin?.networks);
	let fromNetwork = $derived(fromCoin?.networks.find((v) => v.value == fromNetworkValue));
	let toCoin = $derived(swapOptions.to.coins.find((v) => v.coin.value == toCoinValue));
	let toNetworks = $derived(toCoin?.networks);
	let toNetwork = $derived(toCoin?.networks.find((v) => v.value == toNetworkValue));
	const fromCoinItems = $derived(
		swapOptions.from.coins.map((v) => {
			return {
				icon: v.coin.icon,
				value: v.coin.value,
				label: v.coin.label,
				snippet: radioLabel,
				disabled: !v.coin.enabled(
					'from',
					{ coin: fromCoin?.coin, network: fromNetwork },
					{ coin: toCoin?.coin, network: toNetwork },
					auth
				)
			};
		})
	);
	let fromNetworkItems = $derived(
		fromNetworks?.map((v) => {
			return {
				icon: v.icon,
				value: v.value,
				label: v.label,
				snippet: radioLabel,
				disabled: !v.enabled(
					'from',
					{ coin: fromCoin?.coin, network: fromNetwork },
					{ coin: toCoin?.coin, network: toNetwork },
					auth
				)
			};
		})
	);
	const toCoinItems = $derived(
		swapOptions.to.coins.map((v) => {
			return {
				icon: v.coin.icon,
				value: v.coin.value,
				label: v.coin.label,
				snippet: radioLabel,
				disabled: !v.coin.enabled(
					'to',
					{ coin: fromCoin?.coin, network: fromNetwork },
					{ coin: toCoin?.coin, network: toNetwork },
					auth
				)
			};
		})
	);
	let toNetworkItems = $derived(
		toNetworks?.map((v) => {
			return {
				icon: v.icon,
				value: v.value,
				label: v.label,
				snippet: radioLabel,
				disabled: !v.enabled(
					'to',
					{ coin: fromCoin?.coin, network: fromNetwork },
					{ coin: toCoin?.coin, network: toNetwork },
					auth
				)
			};
		})
	);
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}
<fieldset>
	<legend>From:</legend>
	<RadioGroup name="Coin:" bind:value={fromCoinValue} items={fromCoinItems}></RadioGroup>
	{#if fromNetworkItems}
		{#key fromCoin}
			<RadioGroup
				id={`swap-from-${fromCoinValue}`}
				name="Network:"
				bind:value={fromNetworkValue}
				items={fromNetworkItems}
				defaultValue={fromCoin?.default?.value}
			></RadioGroup>
		{/key}
	{/if}
</fieldset>
<fieldset>
	<legend>To:</legend>
	<RadioGroup name="Coin:" bind:value={toCoinValue} items={toCoinItems}></RadioGroup>
	{#if toNetworkItems}
		{#key toCoin}
			<RadioGroup
				id={`swap-to-${fromCoinValue}`}
				name="Network:"
				bind:value={toNetworkValue}
				items={toNetworkItems}
				defaultValue={toCoin?.default?.value}
			></RadioGroup>
		{/key}
	{/if}
	{#if toNetwork && [Network.vsc, Network.hiveMainnet].includes(toNetwork)}
		<HiveUsername style="width: 100%" label={toNetwork.label.split(' ')[0]} />
	{/if}
</fieldset>
