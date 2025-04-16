<script lang="ts">
	// TODO: use https://zagjs.com/components/svelte/steps
	// to have better ux on desktop
	import swapOptions, { Coin, Network, type CoinOptions } from './sendOptions';
	import { getAuth } from '$lib/auth/store';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '../currency/Amount.svelte';

	import { getIntermediaryNetwork } from './getNetwork';
	import { sleep } from 'aninest';
	import V4VPopup from './V4VPopup.svelte';
	import { accountNameFromAddress } from '$lib/getAccountName';
	import Amounts from './Amounts.svelte';
	import CurrencySelect from './CurrencySelect.svelte';
	let { widgetView }: { widgetView?: boolean } = $props();
	let auth = $derived(getAuth()());
	let fromCoin: CoinOptions['coins'][number] | undefined = $state.raw();
	let fromNetwork: Network | undefined = $state.raw();
	let fromAmount: string = $state('0');
	let toCoin: CoinOptions['coins'][number] | undefined = $state.raw();
	let toNetwork: Network | undefined = $state.raw();
	let toUsername: string = $state('');
	$effect(() => {
		if (toUsername.length > 16 && toNetwork == Network.hiveMainnet) {
			toUsername = '';
		}
		if (toUsername != '') return;
		console.log('HERE');
		if (toNetwork == Network.vsc && auth.value?.did) {
			toUsername = auth.value.did.split(':').at(-1)!;
		}
		if (toNetwork == Network.hiveMainnet && auth.value?.aioha && auth.value.username) {
			toUsername = auth.value.username;
		}
	});
	let toAmount: string = $state('0');
	let error = $state('');
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
		let next = getFirstUnfinishedStep();
		if (next != 4) {
			scrollToStep(next);
		}
		error = '';
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
		if (toAmount == '0') {
			return 'Send amount cannot be zero.';
		}
		let intermediary = getIntermediaryNetwork(
			{ coin: fromCoin.coin, network: fromNetwork },
			{ coin: toCoin.coin, network: toNetwork }
		);
		if (intermediary == Network.lightning) {
			openV4V();
			return '';
		}
		return 'Unexpected Error: Unsupported transaction.';
	}
	const enabledOptions = $derived({
		from: { coin: fromCoin?.coin, network: fromNetwork },
		to: { coin: toCoin?.coin, network: toNetwork }
	});
	function getStep(step: number): HTMLFieldSetElement | undefined {
		return document.querySelector(`form#send > fieldset:nth-of-type(${step})`) as
			| HTMLFieldSetElement
			| undefined;
	}
	function scrollToStep(step: number) {
		console.log('Scrolling to step', step);
		getStep(step)?.scrollIntoView({
			behavior: 'smooth',
			block: 'nearest',
			inline: 'center'
		});
	}

	const fromCoinIsDerived = $derived(fromCoin != undefined);
	const fromNetworkIsDerived = $derived(fromNetwork != undefined);
	const toCoinIsDerived = $derived(toCoin != undefined);
	const toNetworkIsDerived = $derived(toNetwork != undefined);
	const toAmountIsDerived = $derived(toAmount && toAmount != '0');

	function getFirstUnfinishedStep(): number {
		const { fromCoin, fromNetwork, toCoin, toNetwork, toAmount } = {
			fromCoin: fromCoinIsDerived,
			fromNetwork: fromNetworkIsDerived,
			toCoin: toCoinIsDerived,
			toNetwork: toNetworkIsDerived,
			toAmount: toAmountIsDerived
		};
		if (!fromCoin || !fromNetwork) return 1;
		if (!toCoin || !toNetwork || !toUsername) return 2;
		if (!toAmount) return 3;
		return 4;
	}
</script>

{#snippet prevNext(stepNum: number)}
	{#if widgetView}
		<div class="nav-buttons">
			<PillButton
				styleType="outline"
				{...{
					onclick: () => {
						scrollToStep(stepNum - 1);
					},
					type: 'button'
				}}
				disabled={stepNum == 1}>Back</PillButton
			>
			<PillButton
				theme="primary"
				styleType="outline"
				{...{
					onclick: () => {
						scrollToStep(stepNum + 1);
					},
					type: 'button'
				}}
				disabled={stepNum == 4}>Next</PillButton
			>
		</div>
	{/if}
{/snippet}

<form
	class={{ complete: fromCoin && fromNetwork && toCoin && toNetwork, widgetView }}
	onsubmit={(e) => {
		error = initSwap(e);
	}}
	id="send"
>
	{#if widgetView}
		<h2>Send</h2>
	{/if}
	<fieldset>
		<legend>From:</legend>
		<CurrencySelect
			options={swapOptions.from}
			bind:coin={fromCoin}
			bind:network={fromNetwork}
			label={'From'}
			{enabledOptions}
		/>
		{@render prevNext(1)}
	</fieldset>
	<fieldset>
		<legend>To:</legend>
		<CurrencySelect
			options={swapOptions.to}
			bind:coin={toCoin}
			bind:network={toNetwork}
			label={'To'}
			{enabledOptions}
			bind:username={toUsername}
		/>
		{@render prevNext(2)}
	</fieldset>
	<fieldset class="amounts">
		<legend>Amount:</legend>
		<!-- {#if !(fromNetwork && toNetwork && fromCoin && toCoin)}
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
		{/if} -->
		<Amounts
			bind:toAmount
			bind:fromAmount
			fromCoin={fromCoin?.coin}
			toCoin={toCoin?.coin}
			{fromNetwork}
			{toNetwork}
		/>
		{@render prevNext(3)}
	</fieldset>
	<fieldset class="submit">
		<legend>Submit</legend>
		{#if fromAmount && fromCoin && fromNetwork && toNetwork && toAmount && toCoin && toUsername && toAmount != '0'}
			<h3>
				Send <Amount coin={fromCoin.coin} network={fromNetwork} amount={fromAmount}></Amount>
				to
				<span class="mono">{accountNameFromAddress(toUsername)}</span
				>{#if toCoin?.coin.value != fromCoin?.coin.value || toNetwork?.value != fromNetwork?.value}
					&nbsp;as <Amount coin={toCoin.coin} network={toNetwork} amount={toAmount}></Amount>{/if}?
			</h3>
		{:else if fromAmount && fromCoin && fromNetwork && toNetwork && toAmount && toCoin && toUsername && toAmount == '0'}
			<h3>Send</h3>
		{:else}
			<!-- {@const coinsInvalid = !toCoin || !fromCoin}
			{@const networksInvalid = !toNetwork || !fromNetwork}
			Must select
			{#if coinsInvalid || networksInvalid}
				{#if coinsInvalid}
					currencies{/if}{#if coinsInvalid && networksInvalid},{/if}
				{#if networksInvalid}
					networks{/if}{#if coinsInvalid && networksInvalid},{/if}
				and
			{/if} amounts before submitting a transaction. -->
			<h3>Send</h3>
		{/if}
		<p class="error">
			{#if error != ''}
				{error}
			{:else}
				&nbsp;
			{/if}
		</p>
		{#if widgetView}
			<div class="nav-buttons">
				<PillButton
					styleType="outline"
					{...{
						onclick: () => {
							scrollToStep(3);
						},
						type: 'button'
					}}>Back</PillButton
				>
				<PillButton
					theme="primary"
					styleType="invert"
					onclick={() => {
						error = '';
					}}
					disabled={showV4VModal}>Send</PillButton
				>
			</div>
		{:else}
			<PillButton onclick={() => {}} disabled={showV4VModal} styleType="invert" theme="primary">
				Send
			</PillButton>
		{/if}
	</fieldset>
</form>

{#if showV4VModal && toCoin && toNetwork && toAmount}
	<V4VPopup
		from={{ coin: Coin.sats, network: Network.lightning }}
		to={{ coin: toCoin.coin, network: toNetwork }}
		{toAmount}
		{auth}
		{toUsername}
		onerror={(v) => {
			error = v;
			showV4VModal = false;
		}}
		onsuccess={() => {
			error = '';
			showV4VModal = false;
		}}
	/>
{/if}

<style lang="scss">
	.submit .error {
		margin-top: auto;
	}
	.submit .nav-buttons {
		margin-top: unset;
	}
	.nav-buttons {
		margin-top: auto;

		display: flex;
		gap: 0.5rem;
		bottom: 0.5rem;
		:global(button) {
			flex-grow: 1;
			flex-basis: 40%;
		}
	}
	form {
		box-sizing: border-box;
		overflow-x: auto;
		display: flex;
		gap: 1rem;
		width: 100%;
		box-sizing: border-box;
		scroll-snap-type: x proximity;
		position: relative;
		flex-wrap: wrap;
		max-width: 42rem;
		margin: auto;
		&.widgetView {
			padding: 1rem;
			padding-left: 0;
			flex-wrap: nowrap;
			height: 28.125rem;
			:global(fieldset) {
				min-height: calc(100% - 2rem);
				margin-top: 1rem;
				width: 300px;
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
	h3 {
		font-weight: 600;
		font-size: var(--text-2xl);
	}

	.amounts {
		justify-content: space-between;
		flex-direction: row;
		flex-wrap: wrap;
		column-gap: 1rem;
	}
	.widgetView .amounts {
		flex-direction: column;
	}

	form > :global(fieldset) {
		box-sizing: border-box;
		width: 100%;
		flex-shrink: 0;
		flex-basis: 280px;
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		position: relative;
	}
	form {
		/* invisible scrollbar */
		scrollbar-width: thin !important;
		scrollbar-color: var(--primary-bg-accent);
	}
	form > fieldset {
		scroll-snap-align: center;
		box-sizing: border-box;
	}

	p {
		margin-top: auto;
		margin-bottom: 0.5rem;
	}
</style>
