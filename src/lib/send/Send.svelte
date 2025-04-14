<script lang="ts">
	import RadioGroup from '../zag/RadioGroup.svelte';
	let fromCoinValue: string | undefined = $state();

	let fromNetworkValue: string | undefined = $state();
	let toCoinValue: string | undefined = $state();
	let toNetworkValue: string | undefined = $state();
	import swapOptions, { Coin, Network, type CoinOptions } from './sendOptions';
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
	import CurrencySelect from './CurrencySelect.svelte';
	let formError = $state();

	let auth = $derived(getAuth()());
	let fromCoin: CoinOptions['coins'][number] | undefined = $state.raw();
	let fromNetwork: Network | undefined = $state.raw();
	let fromAmount: string = $state('0');
	let toCoin: CoinOptions['coins'][number] | undefined = $state.raw();
	let toNetwork: Network | undefined = $state.raw();
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
	const enabledOptions = $derived({
		from: { coin: fromCoin?.coin, network: fromNetwork },
		to: { coin: toCoin?.coin, network: toNetwork }
	});
	$inspect(enabledOptions);
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
	<CurrencySelect
		options={swapOptions.from}
		bind:coin={fromCoin}
		bind:network={fromNetwork}
		label={'From'}
		{enabledOptions}
	/>
	<CurrencySelect
		options={swapOptions.to}
		bind:coin={toCoin}
		bind:network={toNetwork}
		label={'To'}
		{enabledOptions}
	/>
	<!-- <fieldset>
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
	</fieldset> -->
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
