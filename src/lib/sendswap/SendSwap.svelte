<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import {
		Coin,
		Network,
		TransferMethod,
		type NecessarySendDetails,
		type SendDetails
	} from '$lib/sendswap/utils/sendOptions';
	import { blankDetails, getTxSessionId, send, SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import V4VPopup from '$lib/sendswap/V4VPopup.svelte';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import { getUniqueId } from '$lib/zag/idgen';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { sleep } from 'aninest';
	import SwapOptions from './stages/SwapOptions.svelte';
	import PreviewSwap from '$lib/sendswap/stages/ReviewSwap.svelte';
	import NavButtons from './components/NavButtons.svelte';
	import { goto } from '$app/navigation';
	import { getIntermediaryNetwork } from '$lib/sendswap/utils/getNetwork';
	import { untrack } from 'svelte';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Complete from '$lib/sendswap/stages/Complete.svelte';
	import SendOptions from './stages/SendOptions.svelte';
	import Review from './stages/ReviewSend.svelte';

	const { type }: { type: 'send' | 'swap' } = $props();

	const auth = $derived(getAuth()());
	let sessionId = $state(getTxSessionId());
	let status: { message: string; isError: boolean } = $state({ message: '', isError: false });
	let waiting = $state(false);
	let txId = $state('');
	let showV4VModal = $state.raw(false);
	function startDetails(): SendDetails {
		if (type === 'swap') {
			return {
				...blankDetails(),
				toNetwork: Network.vsc,
				method: TransferMethod.lightningTransfer
			};
		} else {
			return {
				...blankDetails(),
				toNetwork: Network.vsc
			};
		}
	}

	SendTxDetails.set(startDetails());
	$effect(() => {
		// sets username for swap
		if (type !== 'swap') return;
		if (auth.value) {
			const username = getUsernameFromAuth(auth);
			if (username) $SendTxDetails.toUsername = username;
		}
	});

	const stepsData =
		type === 'swap'
			? [
					{ value: 'options', label: 'Options', content: swapOptions },
					{ value: 'review', label: 'Review', content: swapReview },
					{ value: 'complete', label: 'Review', content: complete }
				]
			: [
					{ value: 'options', label: 'Options', content: sendOptions },
					{ value: 'review', label: 'Review', content: sendReview },
					{ value: 'complete', label: 'Review', content: complete }
				];

	const id = getUniqueId();

	const service = useMachine(steps.machine, {
		id,
		orientation: 'vertical',
		// linear: true,
		count: stepsData.length - 1
	});

	const api = $derived(steps.connect(service, normalizeProps));

	function openV4V() {
		showV4VModal = false;
		sleep(0).then(() => {
			showV4VModal = true;
		});
	}
	function setStatus(s: string, isError = false) {
		status = { message: s, isError: isError };
	}

	function initSend() {
		const {
			fromCoin,
			fromNetwork,
			toAmount: amount,
			toCoin,
			toNetwork,
			toUsername,
			memo
		} = $SendTxDetails;

		if (!fromCoin || !fromNetwork || !toCoin || !toNetwork) {
			return new Error('Required field undefined.');
		}

		const importantDetails: NecessarySendDetails = {
			fromCoin,
			fromNetwork,
			amount,
			toCoin,
			toNetwork,
			toUsername,
			memo
		};

		let intermediary = getIntermediaryNetwork(
			{ coin: fromCoin.coin, network: fromNetwork },
			{ coin: toCoin.coin, network: toNetwork }
		);

		if (intermediary === Network.lightning) {
			setStatus('Generating Lightning transfer');
			openV4V();
			return;
		}

		waiting = true;
		send(importantDetails, auth, intermediary, setStatus, abortSend.signal).then((res) => {
			if (res instanceof Error) {
				// log the error if it isn't caught
				if (!status.isError) console.error(res.message);
			} else {
				txId = res.id;
			}
		});
		return;
	}

	let stepComplete = $state(false);
	function editStage(id: string, complete: boolean) {
		if (id === stepsData[api.value].value) stepComplete = complete;
	}
	function next() {
		if (api.value === api.count) {
			goto('/transactions');
		} else if (stepsData[api.value].value === 'review') {
			setStatus('');
			initSend();
		} else {
			api.goToNextStep();
		}
	}
	function previous() {
		if (txId) {
			txId = '';
		}
		if (api.value === 0) {
			goto('/');
		} else if (api.value === api.count) {
			api.setStep(0);
			sessionId = getTxSessionId();
			SendTxDetails.set(startDetails());
		} else {
			api.goToPrevStep();
			setStatus('');
		}
	}

	const nextLabel = $derived(
		stepsData[api.value].value === 'review'
			? `${type.at(0)?.toUpperCase() + type.slice(1)}`
			: api.value === stepsData.length - 1
				? 'Done'
				: `Review ${type.at(0)?.toUpperCase() + type.slice(1)}`
	);
	const buttons = $derived({
		fwd: {
			label: nextLabel,
			action: next,
			disabled: !stepComplete
		},
		back:
			api.value !== 0
				? {
						label: 'Back',
						action: previous
					}
				: undefined
	});

	let oldId = '';
	$effect(() => {
		if (txId && txId !== untrack(() => oldId)) {
			waiting = false;
			setStatus('');
			api.setStep(stepsData.length - 1);
			oldId = txId;
		}
	});

	$effect(() => {
		if (status.message.includes('cancelled')) {
			waiting = false;
		}
	});

	// Abort Controls
	const abortSend = new AbortController();
	function cancelSend() {
		abortSend.abort();
		waiting = false;
		status = {
			message: 'Transaction canceled by the user',
			isError: true
		};
	}
</script>

<!-- Swap snippets -->
{#snippet swapOptions(value: string)}
	<SwapOptions id={value} {editStage} />
{/snippet}
{#snippet swapReview()}
	<PreviewSwap {status} {waiting} abort={() => {}} />
{/snippet}
<!-- Send snippets -->
{#snippet sendOptions(value: string)}
	<SendOptions id={value} {editStage} />
{/snippet}
{#snippet sendReview(value: string)}
	<Review {status} {waiting} abort={cancelSend} />
{/snippet}
<!-- Both -->
{#snippet complete()}
	<Complete {txId} type="swap" />
{/snippet}

<div class="send-internal-wrapper">
	{#key sessionId}
		<div {...api.getRootProps()}>
			{#each stepsData as step, index}
				<div {...api.getContentProps({ index })} tabindex="-1">
					{@render step.content(step.value)}
				</div>
			{/each}
		</div>
	{/key}

	<NavButtons {buttons} />
</div>

{#if showV4VModal && $SendTxDetails.toCoin && $SendTxDetails.toNetwork && $SendTxDetails.fromAmount}
	{@const toCoin = $SendTxDetails.toCoin}
	{@const toNetwork = $SendTxDetails.toNetwork}
	{@const toAmount = $SendTxDetails.toAmount}

	<V4VPopup
		from={{ coin: Coin.sats, network: Network.lightning }}
		to={{ coin: toCoin.coin, network: toNetwork }}
		{toAmount}
		{auth}
		toUsername={$SendTxDetails.toUsername}
		onerror={(v) => {
			if (v.includes('Bad request')) {
				setStatus('An error occured, please try again.', true);
			} else {
				setStatus(v.startsWith('Error: ') ? v.substring(7) : v, true);
			}
			showV4VModal = false;
		}}
		onsuccess={(id) => {
			setStatus('');
			// TODO: after success notify via a notification
			// store transaction as pending in local storage
			addLocalTransaction({
				ops: [
					{
						data: {
							amount: new CoinAmount(toAmount, toCoin!.coin).toAmountString(),
							asset: toCoin.coin.unit.toLowerCase(),
							from: `v4vapp`,
							to: $SendTxDetails.toUsername,
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
			txId = id;
			setTimeout(() => {
				showV4VModal = false;
			}, 10000);
		}}
	/>
{/if}

<style lang="scss">
	.send-internal-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	[data-part='root'] {
		flex-grow: 1;
		// width: calc(100vw - 1rem);
		overflow-y: auto;
		padding-bottom: 3rem;
	}
	[data-part='list'] {
		position: absolute;
		left: 6.75rem;
		display: flex;
		flex-direction: column;
		font: inherit;
	}
	[data-part='content'] {
		margin: auto;
		max-width: 42rem;
		padding: 0 0.5rem 1rem 0.5rem;
		min-height: calc(100% - 1rem);
		overflow-y: auto;
		&:focus-visible {
			outline: none;
		}
	}
	.nav-buttons {
		display: flex;
		flex-grow: 1;
		justify-content: space-between;
		padding: 1rem 0;
		align-items: center;
		max-width: 42rem;
	}
	.nav-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100vw;
		background-color: var(--neutral-off-bg);
		border-top: 1px solid var(--neutral-bg-accent);
		display: flex;
		justify-content: center;
	}
	:global(h2) {
		margin-bottom: 1rem !important;
	}
</style>
