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
	$effect(() => {
		if (fromCoin && fromNetwork && (!toCoin || !toNetwork)) {
			document.querySelector('form#send > fieldset:nth-of-type(2)')?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest'
			});
		}
	});

	$effect(() => {
		const onBlur = () => {
			if (toAmount != '0') {
				setTimeout(() => {
					document.querySelector('form#send > fieldset:nth-of-type(4)')?.scrollIntoView({
						block: 'nearest',
						behavior: 'smooth'
					});
				}, 0);
			}
			const amountFieldset = document.querySelector('form#send > fieldset:nth-of-type(3)');
			if (!amountFieldset) return;
			const inputs = amountFieldset.querySelectorAll('input');
			for (const input of inputs) {
				input.removeEventListener('blur', onBlur);
			}
		};
		if (toCoin && toNetwork) {
			setTimeout(() => {
				const amountFieldset = document.querySelector('form#send > fieldset:nth-of-type(3)');
				if (!amountFieldset) return;
				amountFieldset.scrollIntoView({
					block: 'nearest',
					behavior: 'smooth'
				});
				const inputs = amountFieldset.querySelectorAll('input');
				for (const input of inputs) {
					input.addEventListener('blur', onBlur);
				}
			});
		}
		return () => {
			const amountFieldset = document.querySelector('form#send > fieldset:nth-of-type(3)');
			if (!amountFieldset) return;
			const inputs = amountFieldset.querySelectorAll('input');
			for (const input of inputs) {
				input.removeEventListener('blur', onBlur);
			}
		};
	});
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<form
	class={{ complete: fromCoin && fromNetwork && toCoin && toNetwork }}
	onsubmit={initSwap}
	id="send"
>
	<h2>Send</h2>
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
		bind:username={toUsername}
	/>
	{#if fromNetwork && toNetwork && fromCoin && toCoin}
		<fieldset class="amounts">
			<legend>Amount:</legend>
			<Amounts
				bind:toAmount
				bind:fromAmount
				fromCoin={fromCoin.coin}
				toCoin={toCoin.coin}
				{fromNetwork}
				{toNetwork}
			/>
		</fieldset>
	{/if}
	{#if fromAmount && fromCoin && fromNetwork && toNetwork && toAmount && toCoin && toUsername && toAmount != '0'}
		<fieldset class="submit">
			<legend>Submit</legend>
			<h3>
				Send {fromAmount}
				{fromCoin.coin.unit} on {fromNetwork?.label}

				to {accountNameFromAddress(toUsername)}
				{#if toCoin?.coin.value != fromCoin?.coin.value || toNetwork?.value != fromNetwork?.value}
					as {toAmount}
					{toCoin.coin.unit} on {fromNetwork?.label}{/if}?
			</h3>
			{#if formError}
				<p class="error">
					{formError}
				</p>
			{/if}
			<PillButton onclick={() => {}} disabled={showV4VModal} styleType="invert" theme="primary"
				>Send</PillButton
			>
		</fieldset>
	{/if}
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
		height: 25rem;
		box-sizing: border-box;
		overflow-x: auto;
		display: flex;
		gap: 1rem;
		padding: 1rem;
		padding-left: 0;
		width: 100%;
		box-sizing: border-box;
		scroll-snap-type: x proximity;
		position: relative;
	}
	h2 {
		position: sticky;
		font-size: var(--text-2xl);
		font-weight: 400;
		top: -1rem;
		transform: translateY(-2rem);
		left: 0rem;
		width: 0;
		overflow: visible;
	}
	.submit {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.amounts {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		column-gap: 1rem;
	}

	form > :global(fieldset) {
		box-sizing: border-box;
		width: 100%;
		flex-shrink: 0;
		flex-basis: 300px;
	}
	form {
		/* invisible scrollbar */
		scrollbar-width: thin !important;
		scrollbar-color: var(--primary-bg-accent);
	}
	form > :global(fieldset) {
		scroll-snap-align: center;
	}
	form.complete > :global(fieldset:nth-last-of-type(1)) {
		margin-bottom: 1rem;
	}
	form fieldset > :global(button) {
		scroll-snap-stop: always;
		margin: 0;
		display: none;
		width: 100%;
	}
	form.complete fieldset > :global(button) {
		display: unset;
	}
	p {
		margin-top: auto;
		margin-bottom: 0.5rem;
	}
</style>
