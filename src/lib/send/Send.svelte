<script lang="ts">
	import RadioGroup from '../zag/RadioGroup.svelte';
	let fromCoinValue: string | undefined = $state();

	let fromNetworkValue: string | undefined = $state();
	let toCoinValue: string | undefined = $state();
	let toNetworkValue: string | undefined = $state();
	// let fromNetwork: string | undefined = $state();
	import swapOptions, { Coin, Network } from './sendOptions';
	import HiveUsername from '$lib/auth/Username.svelte';
	import { getAuth } from '$lib/auth/store';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from './Amount.svelte';
	let auth = $derived(getAuth()());
	let fromCoin = $derived(swapOptions.from.coins.find((v) => v.coin.value == fromCoinValue));
	let fromNetworks = $derived(fromCoin?.networks);
	let fromNetwork = $derived(fromCoin?.networks.find((v) => v.value == fromNetworkValue));
	let fromAmount: string | undefined = $state('0');
	let toCoin = $derived(swapOptions.to.coins.find((v) => v.coin.value == toCoinValue));
	let toNetworks = $derived(toCoin?.networks);
	let toNetwork = $derived(toCoin?.networks.find((v) => v.value == toNetworkValue));
	let toUsername = $state();
	let toAmount: string | undefined = $state('0');
	function initSwap() {}
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

<form>
	<fieldset>
		<legend>From:</legend>
		<RadioGroup name="From Coin:" id="to-coin" bind:value={fromCoinValue} items={fromCoinItems}
		></RadioGroup>
		{#if fromNetworkItems}
			{#key fromCoin}
				<RadioGroup
					id={`to-network`}
					name="From Network:"
					bind:value={fromNetworkValue}
					items={fromNetworkItems}
					defaultValue={fromCoin?.default?.value}
				></RadioGroup>
			{/key}
		{/if}
	</fieldset>
	<fieldset>
		<legend>To:</legend>
		<RadioGroup name="To Coin:" id="swap-to-coin" bind:value={toCoinValue} items={toCoinItems}
		></RadioGroup>
		{#if toNetworkItems}
			<RadioGroup
				id={`from-network`}
				name="To Network:"
				bind:value={toNetworkValue}
				items={toNetworkItems}
				defaultValue={toCoin?.default?.value}
			></RadioGroup>
		{/if}
		{#if toNetwork && [Network.vsc, Network.hiveMainnet].includes(toNetwork)}
			<HiveUsername
				id="to-username"
				style="width: 100%"
				label={toNetwork.label.split(' ')[0]}
				defaultValue={auth.value?.address}
				bind:value={toUsername}
			/>
		{/if}
	</fieldset>
	{#if fromNetwork && toNetwork && fromCoin && toCoin}
		<fieldset class="amounts">
			<legend>Amount:</legend>
			<Amount
				id="from-amount"
				bind:amount={fromAmount}
				coin={fromCoin!.coin}
				network={fromNetwork}
				label="From Amount:"
				defaultUnit={fromCoin.coin.unit}
			/>
			{#if toCoin && toNetwork}
				<Amount
					id="to-amount"
					bind:amount={toAmount}
					coin={toCoin.coin}
					network={toNetwork}
					label="To Amount:"
					defaultUnit={toCoin.coin.unit}
				/>
			{/if}
		</fieldset>
	{/if}

	<PillButton onclick={initSwap} styleType="outline">
		Send {fromAmount}
		{fromCoin?.coin.unit}
		{#if toUsername}to {toUsername}
		{/if}
	</PillButton>
</form>

<style lang="scss">
	form :global(button) {
		width: 100%;
	}
	.amounts {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
