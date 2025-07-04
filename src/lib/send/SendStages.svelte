<script lang="ts">
	import Recipient from './stages/recipient/Recipient.svelte';
	import SendTitle from './navigation/SendTitle.svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import { onMount } from 'svelte';
	import { Coin, Network, type NecessarySendDetails, type SendDetails } from './sendOptions';
	import Amount from './stages/amount/Amount.svelte';
	import Review from './stages/review/Review.svelte';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import V4VPopup from './V4VPopup.svelte';
	import { getIntermediaryNetwork } from './getNetwork';
	import { authStore } from '$lib/auth/store';
	import { blankDetails, getTxSessionId, send } from './sendUtils';
	import { SendTxDetails } from './sendUtils';
	import { goto } from '$app/navigation';
	import Complete from './stages/complete/Complete.svelte';
	import SendNavButtons from './navigation/SendNavButtons.svelte';
	import { sleep } from 'aninest';
	import Details from './stages/details/Details.svelte';

	let auth = $authStore;
	let windowWidth = $state(0);
	let remValue = $state(0);

	let sessionId = $state(getTxSessionId());
	function stageDetails() {
		return {
			...blankDetails(),
			toNetwork: Network.vsc,
		};
	}
	SendTxDetails.set(stageDetails());

	onMount(() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	});
	// size of content + 2 * (space for tabs + buffer)
	const showTabs = $derived(windowWidth > 42 * remValue + 2 * (6.75 * remValue + 106 + 10));

	let status: { message: string; isError: boolean } = $state({ message: '', isError: false });
	let txId = $state('');

	const stepsData = [
		{ value: 'recipient', label: 'Recipient', content: recipient },
		{ value: 'amount', label: 'Amount', content: amount },
		{ value: 'details', label: 'Details', content: details },
		{ value: 'review', label: 'Review', content: review },
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

	// $inspect(api.count, api.hasNextStep, api.value, api.isCompleted);

	let showV4VModal = $state.raw(false);

	function openV4V() {
		showV4VModal = false;
		sleep(0).then(() => {
			showV4VModal = true;
		});
	}
	function setStatus(s: string, isError = false) {
		status = { message: s, isError: isError };
	}
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
			return;
		}

		send(importantDetails, auth, intermediary, setStatus).then((res) => {
			if (res instanceof Error) {
				// log the error if it isn't caught
				if (!status.isError) console.error(res.message);
			} else {
				txId = res.id;
			}
		});
		return;
	}

	let isDoneInstructions = $derived(
		auth.value?.provider === 'reown' &&
			$SendTxDetails.fromNetwork?.value === Network.hiveMainnet.value &&
			api.value === 3
	);

	let stage = new Set<string>(['details', 'review']);
	let stepComplete = $state(false);
	function editStage(id: string, add: boolean) {
		if (add) {
			stage.add(id);
		} else {
			stage.delete(id);
		}
		for (const val of stage) {
			let i = stepsData.findIndex((step) => step.value === val);
			if (i === api.value) {
				stepComplete = true;
				return;
			}
		}
		stepComplete = false;
	}

	function next() {
		if (api.value === api.count || isDoneInstructions) {
			goto('/transactions');
		} else if (stepsData[api.value].value === 'review') {
			editStage(stepsData[stepsData.length - 1].value, true);
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
			SendTxDetails.set(stageDetails());
		} else {
			api.goToPrevStep();
			setStatus('');
		}
	}

	const nextLabel = $derived(
		stepsData[api.value].value === 'review' && !isDoneInstructions
			? 'Send'
			: api.value === stepsData.length - 1 || isDoneInstructions
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
	$effect(() => {
		if (txId) {
			setStatus('');
			api.setStep(stepsData.length - 1);
		}
	});
</script>

<svelte:window
	bind:innerWidth={windowWidth}
	on:resize={() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	}}
	on:visibilitychange={() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	}}
/>

{#snippet recipient(value: string)}
	<Recipient id={value} {editStage} />
{/snippet}
{#snippet amount(value: string)}
	<Amount id={value} {editStage} />
{/snippet}
{#snippet details()}
	<Details />
{/snippet}
{#snippet review(value: string)}
	<Review {status} />
{/snippet}
{#snippet complete()}
	<Complete {txId} />
{/snippet}

<div class="stages-wrapper">
	<SendTitle close={() => goto('/')} />

	{#key sessionId}
		<div {...api.getRootProps()}>
			{#if showTabs}
				<div {...api.getListProps()}>
					{#each stepsData.slice(0, -1) as step, index}
						<button {...api.getTriggerProps({ index })}>
							<div {...api.getIndicatorProps({ index })}>{step.label}</div>
						</button>
					{/each}
				</div>
			{/if}
			{#each stepsData as step, index}
				<div {...api.getContentProps({ index })}>
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
							asset: toCoin!.coin.unit.toLowerCase(),
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
	.stages-wrapper {
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
		&[data-complete] {
			border-color: var(--primary-bg-accent);
		}
		&[data-current] {
			border-color: var(--accent-mid);
			&:hover {
				cursor: default;
			}
		}
		&[data-incomplete] {
			cursor: default;
			pointer-events: none;
		}
	}
	[data-part='content'] {
		margin: auto;
		max-width: 42rem;
		padding: 0 1rem 1rem 1rem;
		min-height: calc(100% - 1rem);
		overflow-y: scroll;
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
