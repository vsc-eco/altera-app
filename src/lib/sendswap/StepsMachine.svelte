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
	import { untrack, type Component } from 'svelte';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Complete from '$lib/sendswap/stages/Complete.svelte';
	import SendOptions from './stages/SendOptions.svelte';
	import Review from './stages/ReviewSend.svelte';

	type Props = {
		type: string;
		resetDetails?: typeof blankDetails;
		stepsData: {
			value: string;
			label: string;
			component: Component;
		}[];
	};

	let { type, resetDetails, stepsData }: Props = $props();

	const auth = $derived(getAuth()());
	let sessionId = $state(getTxSessionId());
	let status: { message: string; isError: boolean } = $state({ message: '', isError: false });
	let waiting = $state(false);
	let txId = $state('');
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

	// stages and navigation

	const id = $props.id();

	const service = useMachine(steps.machine, {
		id,
		orientation: 'vertical',
		// linear: true,
		count: stepsData.length - 1
	});

	const api = $derived(steps.connect(service, normalizeProps));

	let stepComplete = $state(false);
	function editStage(complete: boolean) {
		stepComplete = complete;
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
			SendTxDetails.set(resetDetails ? resetDetails() : blankDetails());
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

<div class="send-internal-wrapper">
	{#key sessionId}
		<div {...api.getRootProps()}>
			{#each stepsData as step, index}
				{@const Component = step.component}
				<div {...api.getContentProps({ index })} tabindex="-1">
					<Component />
				</div>
			{/each}
		</div>
	{/key}

	<NavButtons {buttons} />
</div>
