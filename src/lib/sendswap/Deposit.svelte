<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Dialog from '$lib/zag/Dialog.svelte';
	import { untrack } from 'svelte';
	import DepositOptions from './stages/deposit/DepositOptions.svelte';
	import { Coin, Network, type NecessarySendDetails, type SendDetails } from './utils/sendOptions';
	import { blankDetails, getTxSessionId, send, SendTxDetails } from './utils/sendUtils';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getIntermediaryNetwork } from './utils/getNetwork';
	import ReviewDeposit from './stages/deposit/ReviewDeposit.svelte';
	import Complete from './stages/Complete.svelte';
	import QuickSendNavButtons from './components/QuickSendNavButtons.svelte';
	import { sleep } from 'aninest';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import V4VPopup from './V4VPopup.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';

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

	let resetInput = $state(0);
	function startDetails(): SendDetails {
		return {
			...blankDetails(),
			toNetwork: Network.vsc
		};
	}
	$effect(() => {
		sessionId;
		SendTxDetails.set(startDetails());
		untrack(() => {
			if (auth.value) {
				const username = getUsernameFromAuth(auth);
				if (username) $SendTxDetails.toUsername = username;
			}
			if (txId) {
				txId = '';
			}
			api.setStep(0);
			resetInput++;
		});
	});

	// SENDING
	let status: { message: string; isError: boolean } = $state({ message: '', isError: false });
	let txId = $state('');
	function setStatus(s: string, isError = false) {
		status = { message: s, isError: isError };
	}

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

	const id = $props.id();
	const service = useMachine(steps.machine, {
		id,
		// linear: true,
		count: stepsData.length - 1
	});
	const api = $derived(steps.connect(service, normalizeProps));

	function next() {
		if (api.value === api.count) {
			toggle(false);
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
			toggle(false);
		} else if (api.value === api.count) {
			api.setStep(0);
			sessionId = getTxSessionId();
			SendTxDetails.set(startDetails());
		} else {
			api.goToPrevStep();
			setStatus('');
		}
	}

	const buttons = $derived({
		fwd: {
			label: 'Deposit',
			action: next
		},
		back: {
			label: 'Back',
			action: previous
		}
	});
</script>

{#snippet options()}
	<DepositOptions {next} />
{/snippet}
{#snippet review()}
	<ReviewDeposit {status} waiting={false} abort={() => {}} />
	<QuickSendNavButtons {buttons} small={true} />
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
						{#key resetInput}
							{@render step.content()}
						{/key}
					</div>
				{/each}
			</div>
		{/key}
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

<div class="deposit-internal-wrapper"></div>

<style lang="scss">
	[data-part='root'] {
		display: flex;
	}
	[data-part='content'] {
		width: 32rem;
		min-width: min-content;
		&:focus-visible {
			outline: none;
		}
	}
</style>
