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
	import Amount from '../currency/Amount.svelte';
	import { getIntermediaryNetwork } from './getNetwork';
	import { sleep } from 'aninest';
	import V4VPopup from './V4VPopup.svelte';
	import { accountNameFromAddress } from '$lib/getAccountName';
	import { convert } from '$lib/currency/convert';
	import { untrack } from 'svelte';
	import Amounts from './Amounts.svelte';
	let formError = $state();

	let auth = $derived(getAuth()());
	let fromCoin = $derived(swapOptions.from.coins.find((v) => v.coin.value == fromCoinValue));
	let fromNetworks = $derived(fromCoin?.networks);
	let fromNetwork = $derived(fromCoin?.networks.find((v) => v.value == fromNetworkValue));
	let fromAmount: string = $state('0');
	let toCoin = $derived(swapOptions.to.coins.find((v) => v.coin.value == toCoinValue));
	let toNetworks = $derived(toCoin?.networks);
	let toNetwork = $derived(toCoin?.networks.find((v) => v.value == toNetworkValue));
	let toUsername: string | undefined = $state();
	let toAmount: string = $state('0');
	let showV4VModal = $state.raw(false);
	function openV4V() {
		showV4VModal = false;
		sleep(0).then(() => {
			showV4VModal = true;
		});
	}
	function initSwap(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		formError = undefined;
		if (!fromCoin) {
			return 'No From Coin Selected';
		}
		if (!fromNetwork) {
			return 'No From Network Selected';
		}
		if (!toCoin) {
			return 'No To Coin Selected';
		}
		if (!toNetwork) {
			return 'No To Network Selected';
		}
		let intermediary = getIntermediaryNetwork(
			{ coin: fromCoin.coin, network: fromNetwork },
			{ coin: toCoin.coin, network: toNetwork }
		);
		if (intermediary == Network.lightning) {
			openV4V();
		}
	}
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

<form onsubmit={initSwap}>
	<p class="error">
		{#if formError}
			{formError}
		{:else}
			&nbsp;
		{/if}
	</p>
	<fieldset>
		<legend>From:</legend>
		<RadioGroup
			required
			name="From Coin:"
			id="to-coin"
			bind:value={fromCoinValue}
			items={fromCoinItems}
		></RadioGroup>
		{#if fromNetworkItems}
			{#key fromCoin}
				<RadioGroup
					required
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
		<RadioGroup
			required
			name="To Coin:"
			id="swap-to-coin"
			bind:value={toCoinValue}
			items={toCoinItems}
		></RadioGroup>
		{#if toNetworkItems}
			<RadioGroup
				required
				id={`from-network`}
				name="To Network:"
				bind:value={toNetworkValue}
				items={toNetworkItems}
				defaultValue={toCoin?.default?.value}
			></RadioGroup>
		{/if}
		{#if toNetwork && [Network.vsc, Network.hiveMainnet].includes(toNetwork)}
			<HiveUsername
				required
				id="to-username"
				style="width: 100%"
				label={toNetwork.label.split(' ')[0]}
				defaultValue={auth.value?.address}
				bind:value={toUsername}
			/>
		{/if}
	</fieldset>
	{#if fromNetwork && toNetwork && fromCoin && toCoin}
		<Amounts
			bind:toAmount
			bind:fromAmount
			fromCoin={fromCoin.coin}
			toCoin={toCoin.coin}
			{fromNetwork}
			{toNetwork}
		/>
	{/if}
	<p>
		{#if fromAmount && fromCoin && toAmount && toCoin && toUsername}
			Send {fromAmount}
			{fromCoin?.coin.unit}

			to {accountNameFromAddress(toUsername)}

			as {toAmount}
			{toCoin?.coin.unit}?
		{:else}
			&nbsp;
		{/if}
	</p>
	<PillButton onclick={() => {}} disabled={showV4VModal} styleType="invert" theme="primary"
		>Send</PillButton
	>
</form>

{#if showV4VModal && toCoin && toNetwork && toAmount}
	<V4VPopup
		from={{ coin: Coin.sats, network: Network.lightning }}
		to={{ coin: toCoin.coin, network: toNetwork }}
		{toAmount}
		{auth}
		onerror={(v) => {
			formError = v;
			showV4VModal = false;
		}}
		onsuccess={() => {
			formError = '';
			showV4VModal = false;
		}}
	/>
{/if}

<style lang="scss">
	form {
		max-width: 34.5rem;
		box-sizing: border-box;
	}
	form :global(button) {
		width: 100%;
	}
</style>
