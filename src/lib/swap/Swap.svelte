<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import {
		Coin,
		Network,
		TransferMethod,
		type NecessarySendDetails,
		type SendDetails
	} from '$lib/send/sendOptions';
	import { blankDetails, getTxSessionId, SendTxDetails } from '$lib/send/sendUtils';
	import V4VPopup from '$lib/send/V4VPopup.svelte';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import { getUniqueId } from '$lib/zag/idgen';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { sleep } from 'aninest';
	import SelectSwap from './SelectSwap.svelte';
	import SendTitle from '$lib/send/navigation/SendTitle.svelte';
	import { goto } from '$app/navigation';
	import SendNavButtons from '$lib/send/navigation/SendNavButtons.svelte';
	import { getIntermediaryNetwork } from '$lib/send/getNetwork';
	import { onDestroy, onMount, tick, untrack, type Snippet } from 'svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import PreviewSwap from './PreviewSwap.svelte';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Complete from '$lib/send/stages/complete/Complete.svelte';

	const auth = $derived(getAuth()());
	let windowWidth = $state(0);
	let sessionId = $state(getTxSessionId());
	let status: { message: string; isError: boolean } = $state({ message: '', isError: false });
	let waiting = $state(false);
	let txId = $state('');
	let showV4VModal = $state.raw(false);
	function swapDetails(): SendDetails {
		return {
			...blankDetails(),
			toNetwork: Network.vsc,
			fromNetwork: Network.lightning,
			method: TransferMethod.lightningTransfer
		};
	}
	SendTxDetails.set(swapDetails());
	$effect(() => {
		if (auth.value) {
			const username = getUsernameFromAuth(auth);
			if (username) $SendTxDetails.toUsername = username;
		}
	});

	function openV4V() {
		showV4VModal = false;
		sleep(0).then(() => {
			showV4VModal = true;
		});
	}
	function setStatus(s: string, isError = false) {
		status = { message: s, isError: isError };
	}

	const stepsData = [
		{ value: 'options', label: 'Options', content: select },
		{ value: 'review', label: 'Review', content: preview },
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

	function initSwap() {
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
			// waiting = true;
			return;
		}
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
			initSwap();
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
			SendTxDetails.set(swapDetails());
		} else {
			api.goToPrevStep();
			setStatus('');
		}
	}

	const nextLabel = $derived(
		stepsData[api.value].value === 'review'
			? 'Send'
			: api.value === stepsData.length - 1
				? 'Done'
				: 'Next'
	);
	const buttons = $derived({
		fwd: {
			label: nextLabel,
			action: next,
			disabled: !stepComplete
		},
		back: {
			label: 'Back',
			action: previous
		}
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
</script>

{#snippet select(value: string)}
	<SelectSwap id={value} {editStage} />
{/snippet}
{#snippet preview()}
	<PreviewSwap {status} {waiting} abort={() => {}} />
{/snippet}
{#snippet complete()}
	<Complete {txId} type="swap" />
{/snippet}

<div class="swap-internal-wrapper">
	<SendTitle close={() => goto('/')} />

	{#key sessionId}
		<div {...api.getRootProps()}>
			{#each stepsData as step, index}
				<div {...api.getContentProps({ index })} tabindex="-1">
					{@render step.content(step.value)}
				</div>
			{/each}
		</div>
	{/key}

	<SendNavButtons {buttons} />
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
	.swap-internal-wrapper {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}
	[data-part='root'] {
		flex-grow: 1;
		width: calc(100vw - 1rem);
		max-height: 100vh;
		overflow-y: auto;
	}
	[data-part='list'] {
		position: absolute;
		left: 6.75rem;
		display: flex;
		flex-direction: column;
		font: inherit;
	}
	[data-part='trigger'] {
		font: inherit;
		background: none;
		border: none;
		padding: 0;
		margin: 0rem 0.25rem;
		cursor: pointer;
		text-align: left;
		border-left: 2px solid var(--neutral-bg-accent);
		padding: 0.5rem 1rem;
		color: var(--fg);
		text-wrap: nowrap;
		box-sizing: border-box;
		text-decoration: none;

		&:hover {
			border-color: var(--neutral-bg-accent-shifted);
		}
		&[data-visited='false'] {
			cursor: default;
			pointer-events: none;
		}
		&[data-complete] {
			border-color: var(--primary-bg-accent);
			pointer-events: auto;
			cursor: pointer;
		}
		&[data-current] {
			border-color: var(--accent-mid);
			&:hover {
				cursor: default;
			}
		}
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
		margin-top: 0 !important;
	}
</style>
