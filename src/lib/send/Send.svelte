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
	import { accountNameFromAddress, getDidFromUsername } from '$lib/getAccountName';
	import Amounts from './Amounts.svelte';
	import CurrencySelect from './CurrencySelect.svelte';
	import { untrack } from 'svelte';
	import Receipt from './Receipt.svelte';
	import { executeTx, getSendOpGenerator, getSendOpType } from '$lib/vscTransactions/hive';
	import { getEVMOpType } from '$lib/vscTransactions/eth';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import type { TransferOperation } from '@hiveio/dhive';
	import { addLocalTransaction } from './localStorageTxs';
	import { idchain } from 'viem/chains';
	import { uuid } from 'uuidv4';
	import { createClient, signAndBrodcastTransaction } from '$lib/vscTransactions/eth/client';
	import { wagmiSigner } from '$lib/vscTransactions/eth/wagmi';
	import { type Config, getAccount } from '@wagmi/core';
	import { wagmiConfig, modal } from '$lib/auth/reown';
	import { ensureWalletConnection } from '$lib/auth/reown/reconnect';

	let { widgetView, hideToUsername }: { widgetView?: boolean; hideToUsername?: boolean } = $props();
	let auth = $derived(getAuth()());
	let fromCoin: CoinOptions['coins'][number] | undefined = $state.raw();
	let fromNetwork: Network | undefined = $state.raw();
	let fromAmount: string = $state('0');
	let toCoin: CoinOptions['coins'][number] | undefined = $state.raw();
	let toNetwork: Network | undefined = $state.raw();
	let toUsername: string = $state('');
	let error = $state('');
	let status = $state('');
	$effect(() => {
		if (error != '') {
			status = '';
		}
	});
	$effect(() => {
		let username = untrack(() => toUsername);
		if (username.length > 16 && toNetwork == Network.hiveMainnet) {
			toUsername = '';
		}

		username = untrack(() => toUsername);
		if (username != '') return;
		if (toNetwork == Network.vsc && auth.value?.did) {
			toUsername = auth.value.did.split(':').at(-1)!;
		}
		if (toNetwork == Network.hiveMainnet && auth.value?.aioha && auth.value.username) {
			toUsername = auth.value.username;
		}
	});
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
		if (intermediary == Network.vsc) {
			if (auth.value?.provider == 'reown') {
				// account check in signAndBroadcast
				console.log('Auth DID:', auth.value.did);

				const client = createClient(auth.value.did);
				console.log('Created client:', client);

				const sendOp = getEVMOpType(
					fromNetwork,
					toNetwork,
					auth.value.did,
					getDidFromUsername(toUsername),
					new CoinAmount(toAmount, toCoin.coin)
				);

				console.log('Transaction operation:', sendOp);
				status = 'Preparing transaction for signing...';

				signAndBrodcastTransaction(
					[sendOp],
					wagmiSigner,
					client,
					wagmiConfig
				)
					.then((result) => {
						console.log('Transaction successful:', result);
						status = `Transaction submitted successfully!`;
						// TODO: add back once backend fixed
						// addLocalTransaction({
						// 	ops: [
						// 		{
						// 			data: {
						// 				...sendOp.payload,
						// 				type: sendOp.op
						// 			},
						// 			type: sendOp.op,
						// 			index: 0
						// 		}
						// 	],
						// 	timestamp: new Date(),
						// 	id: result.id,
						// 	type: 'vsc'
						// });
						return result.id;
					})
					.catch((error) => {
						console.error('Transaction error:', error);
						if (error instanceof Error) {
							if (error.message.includes('User rejected') || error.message.includes('rejected')) {
								status = 'Transaction was cancelled by user';
							} else if (error.message.includes('wallet')) {
								status = 'Please connect your wallet and try again';
							} else if (error.message.includes('422')) {
								status = 'Transaction format error. Please check your inputs and try again';
							} else if (error.message.includes('network') || error.message.includes('Network')) {
								status = 'Network error. Please check your connection and try again';
							} else if (error.message.includes('not enough RCs')) {
								status = "Not enough Resource Credits. Please deposit HBD and try again."
							} else {
								status = 'Transaction failed.';
							}
						} else {
							status = 'Unknown error occurred during transaction';
						}
					});
				return '';
			}
			if (!auth.value?.aioha) return "VSC Transactions via an EVM wallet isn't supported yet.";
			const getSendOp = getSendOpGenerator(fromNetwork, toNetwork);
			const opType = getSendOpType(fromNetwork, toNetwork);
			status = 'Waiting for Hive wallet approval…';
			// note that fromCoin and toCoin should be the same
			const sendOp = getSendOp(
				auth.value.username!,
				getDidFromUsername(toUsername),
				new CoinAmount(toAmount, toCoin.coin)
			);
			console.log('sendOp', sendOp);
			executeTx(auth.value.aioha, [sendOp]).then(async (res) => {
				if (res.success) {
					// status = `Transaction submitted. You will be notified when your transaction is finished.`;
					status = `Transaction submitted. Your transaction should appear shortly.`;
					addLocalTransaction({
						ops: [
							{
								data: {
									amount: new CoinAmount(toAmount, toCoin!.coin).toAmountString(),
									asset: toCoin!.coin.unit.toLowerCase(),
									from: auth.value!.username!,
									to: toUsername,
									memo: sendOp[1]?.memo ?? '',
									type: 'transfer'
								},
								type: opType!,
								index: 0
							}
						],
						timestamp: new Date(),
						id: res.result,
						type: 'hive'
					});
					error = '';
					return;
				}
				error = res.error;
			});
			return '';
		}
		if (intermediary == Network.hiveMainnet) {
			if (!auth.value?.aioha)
				return "Hive Mainnet Transactions via an EVM wallet isn't supported yet.";
			status = 'Waiting for Hive wallet approval…';
			const toCoinAmount = new CoinAmount(toAmount, toCoin!.coin);
			executeTx(auth.value?.aioha, [
				[
					'transfer',
					{
						from: auth.value.username!,
						to: toUsername,
						amount: toCoinAmount.toPrettyString(),
						memo: ''
					}
				] satisfies TransferOperation
			]).then((res) => {
				if (res.success) {
					status = `Transaction submitted. You will be notified when your transaction is finished.`;
					addLocalTransaction({
						ops: [
							{
								data: {
									amount: new CoinAmount(toAmount, toCoin!.coin).toAmountString(),
									asset: toCoin!.coin.unit.toLowerCase(),
									from: auth.value!.username!,
									to: toUsername,
									memo: '',
									type: 'transfer'
								},
								type: 'transfer',
								index: 0
							}
						],
						timestamp: new Date(),
						id: res.result,
						type: 'hive'
					});
					error = '';
					return;
				}
				error = res.error;
			});
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
	const mode = $derived(hideToUsername ? 'swap' : 'send');

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

{#if widgetView}
	<h5>Send</h5>
{/if}
<form
	class={{ complete: fromCoin && fromNetwork && toCoin && toNetwork, widgetView }}
	onsubmit={(e) => {
		error = initSwap(e);
	}}
	id="send"
>
	<fieldset>
		<legend>From:</legend>
		<CurrencySelect
			options={swapOptions.from}
			bind:coin={fromCoin}
			bind:network={fromNetwork}
			label={'From'}
			{enabledOptions}
			{mode}
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
			{mode}
		/>
		{@render prevNext(2)}
	</fieldset>
	<fieldset class="amounts">
		<legend>Amount:</legend>
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
				Send <Amount network={fromNetwork} amount={new CoinAmount(fromAmount, fromCoin.coin)}
				></Amount>
				to
				<span class="mono">{accountNameFromAddress(toUsername)}</span
				>{#if toCoin?.coin.value != fromCoin?.coin.value || toNetwork?.value != fromNetwork?.value}
					&nbsp;as <Amount network={toNetwork} amount={new CoinAmount(toAmount, toCoin.coin)}
					></Amount>{/if}?
			</h3>
			<Receipt
				fromCoin={fromCoin.coin}
				{fromNetwork}
				toCoin={toCoin.coin}
				{toNetwork}
				{fromAmount}
				{toAmount}
			/>
		{:else}
			<h3>Send</h3>
		{/if}
		<p class={{ error, status }}>
			{#if error != ''}
				{error}
			{:else if status}
				{status}
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
		onsuccess={(id) => {
			error = '';
			// TODO: after success notify via a notification
			// store transaction as pending in local storage
			addLocalTransaction({
				ops: [
					{
						data: {
							amount: new CoinAmount(toAmount, toCoin!.coin).toAmountString(),
							asset: toCoin!.coin.unit.toLowerCase(),
							from: `v4vapp`,
							to: toUsername,
							memo: `altera_id=${id}`,
							type: 'transfer'
						},
						type: 'transfer',
						index: 0
					}
				],
				timestamp: new Date(),
				id: id,
				type: 'v4v'
			});
			setTimeout(() => {
				showV4VModal = false;
			}, 10000);
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
		margin: auto;
		&.widgetView {
			padding: 0 0.75rem 0.75rem 0.75rem;
			flex-wrap: nowrap;
			height: 28.125rem;
			:global(fieldset) {
				min-height: calc(100% - 2rem);
				width: 300px;
			}
		}
	}
	h3 {
		font-weight: 600;
		font-size: var(--text-2xl);
	}
	h3 > :global(span),
	h3 {
		line-height: 0.5rem;
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

	h5 {
		margin-left: 0.75rem;
	}
</style>
