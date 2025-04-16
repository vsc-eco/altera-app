<script lang="ts">
	// TODO: use https://zagjs.com/components/svelte/steps
	// to have better ux on desktop
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
	import { transactions } from '../../routes/(authed)/transactions/sampleData';
	let formError = $state();
	let { widgetView }: { widgetView?: boolean } = $props();
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
	function scrollToStep(step: number) {
		console.log('Scrolling to step', step);
		document.querySelector(`form#send > fieldset:nth-of-type(${step})`)?.scrollIntoView({
			behavior: 'smooth',
			block: 'nearest'
		});
	}
	$effect(() => {
		if (fromCoin && fromNetwork && (!toCoin || !toNetwork)) {
			scrollToStep(2);
		}
	});

	$effect(() => {
		const onBlur = () => {
			if (toAmount != '0') {
				setTimeout(() => {
					scrollToStep(4);
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
	const typeButton = {
		type: 'button',
		onclick: (e: MouseEvent) => {
			console.log('HERE');
			e.preventDefault();
			e.stopPropagation();
			scrollToStep(3);
		}
	} as const;
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<form
	class={{ complete: fromCoin && fromNetwork && toCoin && toNetwork, widgetView }}
	onsubmit={initSwap}
	id="send"
>
	{#if widgetView}
		<h2>Send</h2>
	{/if}
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
	<fieldset class="amounts">
		<legend>Amount:</legend>
		{#if !(fromNetwork && toNetwork && fromCoin && toCoin)}
			{@const networksInvalid = !fromNetwork || !toNetwork}
			{@const coinsInvalid = !fromCoin || !toCoin}
			Must select
			{#if coinsInvalid}
				currencies
			{/if}
			{#if coinsInvalid && networksInvalid}
				and
			{/if}
			{#if networksInvalid}
				networks
			{/if}
			first before selecting amounts.
		{/if}
		<Amounts
			disabled={!(fromNetwork && toNetwork && fromCoin && toCoin)}
			bind:toAmount
			bind:fromAmount
			fromCoin={fromCoin?.coin}
			toCoin={toCoin?.coin}
			{fromNetwork}
			{toNetwork}
		/>
	</fieldset>
	<fieldset class="submit">
		<legend>Submit</legend>
		{#if fromAmount && fromCoin && fromNetwork && toNetwork && toAmount && toCoin && toUsername && toAmount != '0'}
			<h3>
				Send {fromAmount}
				{fromCoin.coin.unit} from {fromNetwork?.label}

				to {accountNameFromAddress(toUsername)}
				{#if toCoin?.coin.value != fromCoin?.coin.value || toNetwork?.value != fromNetwork?.value}
					as {toAmount}
					{toCoin.coin.unit} on {toNetwork?.label}{/if}?
			</h3>
			{#if formError}
				<p class="error">
					{formError}
				</p>
			{/if}
			<PillButton onclick={() => {}} disabled={showV4VModal} styleType="invert" theme="primary"
				>Send</PillButton
			>
		{:else if fromAmount && fromCoin && fromNetwork && toNetwork && toAmount && toCoin && toUsername && toAmount == '0'}
			<span>
				Send amount cannot be zero. Please <PillButton
					styleType="text"
					theme="primary"
					{...typeButton}>select some positive amount</PillButton
				> to send.
			</span>
		{:else}
			Must select
			{#if !toCoin || !fromCoin || !toNetwork || !fromNetwork}
				{@const coinsInvalid = !toCoin || !fromCoin}
				{@const networksInvalid = !toNetwork || !fromNetwork}
				{#if coinsInvalid}
					currencies{/if}{#if coinsInvalid && networksInvalid},{/if}
				{#if networksInvalid}
					networks{/if}{#if coinsInvalid && networksInvalid},{/if}
				and
			{/if} amounts before submitting this transaction.
		{/if}
	</fieldset>
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
		flex-wrap: wrap;
		max-width: 42rem;
		margin: auto;
		&.widgetView {
			flex-wrap: nowrap;
			height: 25rem;
			:global(fieldset) {
				min-height: calc(100% - 2rem);
				margin-top: 1rem;
			}
		}
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
		height: 20rem;
		box-sizing: border-box;
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
