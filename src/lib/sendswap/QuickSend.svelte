<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import {
		blankDetails,
		getDisplayName,
		getTxSessionId,
		send,
		SendTxDetails
	} from './utils/sendUtils';
	import Complete from './stages/Complete.svelte';
	import ReviewSend from './stages/ReviewSend.svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getAuth } from '$lib/auth/store';
	import QuickSendNavButtons from './components/QuickSendNavButtons.svelte';
	import { untrack } from 'svelte';
	import { Coin, Network, TransferMethod, type NecessarySendDetails } from './utils/sendOptions';
	import { getIntermediaryNetwork } from './utils/getNetwork';
	import { sleep } from 'aninest';
	import V4VPopup from './V4VPopup.svelte';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import QuickSendOptions from './stages/QuickSendOptions.svelte';

	let {
		dialogOpen = $bindable(),
		toggle = $bindable(),
		sessionId
	} = $props<{
		dialogOpen: boolean;
		toggle: (open?: boolean) => void;
		sessionId: number;
	}>();

	const auth = $derived(getAuth()());

	function quickDetails() {
		return {
			...blankDetails(),
			fromNetwork: Network.vsc,
			toNetwork: Network.vsc,
			method: TransferMethod.vscTransfer
		};
	}

	$effect(() => {
		const _ = sessionId;
		// set defaults for quicksend
		SendTxDetails.set(quickDetails());
	});

	let status: { message: string; isError: boolean } = $state({ message: '', isError: false });
	let txId = $state('');
	function setStatus(s: string, isError = false) {
		status = { message: s, isError: isError };
	}

	// SENDING
	let showV4VModal = $state.raw(false);
	function openV4V() {
		showV4VModal = false;
		sleep(0).then(() => {
			showV4VModal = true;
		});
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

	// STEPS
	const stepsData = [
		{ value: 'options', content: options },
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

	$effect(() => {
		const _ = sessionId;
		untrack(() => {
			if (txId) {
				txId = '';
			}
			api.setStep(0);
		});
	});

	let isDoneInstructions = $derived(
		auth.value?.provider === 'reown' &&
			$SendTxDetails.fromNetwork?.value === Network.hiveMainnet.value &&
			api.value === 1
	);

	let stage = new Set<string>(['review']);
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
			toggle(false);
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
			toggle(false);
		} else if (api.value === api.count) {
			api.setStep(0);
			sessionId = getTxSessionId();
			SendTxDetails.set(quickDetails());
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
	let hideNav = $state(false);
</script>

{#snippet options(value: string)}
	<QuickSendOptions id={value} {editStage} bind:hideNav />
{/snippet}

{#snippet review()}
	<ReviewSend {status} compact waiting={false} abort={() => {}} />
{/snippet}

{#snippet complete()}
	<Complete {txId} close={() => toggle(false)} />
{/snippet}

<Dialog bind:toggle bind:open={dialogOpen}>
	{#snippet content()}
		{#key sessionId}
			<div {...api.getRootProps()}>
				{#each stepsData as step, index}
					<div {...api.getContentProps({ index })} tabindex="-1">
						{@render step.content(step.value)}
					</div>
				{/each}
			</div>
		{/key}
		{#if !hideNav}
			<QuickSendNavButtons {buttons} small={true} />
		{/if}
	{/snippet}
</Dialog>

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
	[data-part='root'] {
		display: flex;
	}
	[data-part='content'] {
		width: 32rem;
		min-width: min-content;
	}
</style>
