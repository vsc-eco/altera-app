<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import { Coin, Network, type CoinOnNetwork, type CoinOptions } from './sendOptions';
	import Username from '$lib/auth/Username.svelte';
	import type { Snippet } from 'svelte';
	type Props = {
		options: CoinOptions;
		coin?: CoinOptions['coins'][number] | undefined;
		network: Network | undefined;
		label: 'To' | 'From';
		username?: string | undefined;
		enabledOptions: { from?: Partial<CoinOnNetwork>; to?: Partial<CoinOnNetwork> };
	};
	let {
		coin = $bindable(),
		network = $bindable(),
		label,
		username = $bindable(),
		options,
		enabledOptions
	}: Props = $props();
	let auth = $derived(getAuth()());
	let coinValue: string | undefined = $state();
	let networkValue: string | undefined = $state();
	$effect(() => {
		coin = options.coins.find((v) => v.coin.value == coinValue);
	});
	let coinItems = $derived(
		options.coins.map((v) => {
			return {
				icon: v.coin.icon,
				value: v.coin.value,
				label: v.coin.label,
				snippet: radioLabel,
				disabled: !v.coin.enabled(
					label.toLowerCase() as Lowercase<typeof label>,
					enabledOptions,
					auth
				)
			};
		})
	);
	let networks = $derived(coin?.networks);
	let networkItems = $derived(
		networks?.map((v) => {
			return {
				icon: v.icon,
				value: v.value,
				label: v.label,
				snippet: radioLabel,
				disabled: !v.enabled('to', enabledOptions, auth)
			};
		})
	);
	$inspect(label, coinItems);
	$inspect(label, networkItems);
	$effect(() => {
		network = coin?.networks.find((v) => v.value == networkValue);
	});
	$inspect(username);
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<fieldset>
	<legend>{label}:</legend>
	<RadioGroup
		required
		name={label + ' Coin:'}
		id={label + '-coin'}
		bind:value={coinValue}
		items={coinItems}
	></RadioGroup>
	{#if networkItems}
		{#key coin}
			<RadioGroup
				required
				id={label + `-network`}
				name={label + ' Network:'}
				bind:value={networkValue}
				items={networkItems}
				defaultValue={coin?.default?.value}
			></RadioGroup>
		{/key}
	{/if}
	{#if label == 'To' && network && [Network.vsc, Network.hiveMainnet].includes(network)}
		<Username
			required
			id="to-username"
			style="width: 100%"
			label={network.label.split(' ')[0]}
			defaultValue={auth.value?.address}
			bind:value={username}
		/>
	{/if}
</fieldset>
