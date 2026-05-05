<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { getTxSessionId, send } from '$lib/sendswap/utils/sendUtils';
	import { useTxState } from '$lib/sendswap/utils/txState.svelte';
	import V4VPopup from '$lib/sendswap/V4VPopup.svelte';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { sleep } from 'aninest';
	import NavButtons from '$lib/sendswap/components/NavButtons.svelte';
	import { goto } from '$app/navigation';
	import { getIntermediaryNetwork } from '$lib/sendswap/utils/getNetwork';
	import { untrack, type Component, type ComponentProps } from 'svelte';
	import { getDidFromUsername } from '$lib/getAccountName';
	import { getSendOpType } from '$lib/magiTransactions/hive';

	type TransferComponentTypes =
		| { editStage: (complete: boolean) => void }
		| {
				status: { message: string; isError: boolean };
				waiting?: boolean;
				abort?: () => void;
		  }
		| { txId: string; close?: () => void };
	interface StepData<T extends TransferComponentTypes = TransferComponentTypes> {
		value: string;
		component: Component<T>;
		/** When true, the previous stage stays visible (popup-style) and the
		 *  bottom NavBar is hidden — the stage component is responsible for
		 *  rendering its own confirm/cancel buttons inside its dialog/overlay. */
		popup?: boolean;
	}
	export type MixedStepsArray = Array<StepData<any>>;
	type Props = {
		size: 'page' | 'dialog';
		minHeight?: number;
		txType: string;
		/** Called when the user resets back to step 0 from the complete screen. */
		resetState?: () => void;
		stepsData: MixedStepsArray;
		extraProps?: { [key: string]: any };
		onSubmit?: (
			setStatus: (s: string, isError?: boolean) => void,
			signal: AbortSignal
		) => Promise<Error | { id: string }>;
	};

	let { size, minHeight, txType, resetState, stepsData, extraProps, onSubmit }: Props = $props();

	const txState = useTxState();

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

	const service = $derived(
		useMachine(steps.machine, {
			id,
			orientation: 'vertical',
			// linear: true,
			count: stepsData.length - 1
		})
	);

	const api = $derived(steps.connect(service, normalizeProps));

	let onHomePage = $state(true);
	let stepComplete = $state(false);
	function editStage(complete: boolean) {
		stepComplete = complete;
	}
	function next() {
		if (api.value === api.count) {
			if (extraProps && 'close' in extraProps) {
				extraProps.close();
			} else {
				goto('/transactions');
			}
		} else if (stepsData[api.value].value === 'review') {
			setStatus('');
			if (onSubmit) {
				waiting = true;
				onSubmit(setStatus, abortSend.signal).then((res) => {
					if (res instanceof Error) {
						console.error(res.message);
					} else {
						txId = res.id;
					}
					waiting = false;
				});
			} else {
				initSend();
			}
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
			resetState?.();
		} else {
			api.goToPrevStep();
			setStatus('');
		}
	}

	const nextLabel = $derived(
		stepsData[api.value].value === 'review'
			? `${txType.at(0)?.toUpperCase() + txType.slice(1)}`
			: api.value === stepsData.length - 1
				? 'Done'
				: `Review ${txType.at(0)?.toUpperCase() + txType.slice(1)}`
	);
	let customButtons: ComponentProps<typeof NavButtons>['buttons'] | undefined = $state();

	const buttons = $derived(
		customButtons ?? {
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
		}
	);
	$effect(() => {
		if (status.message.includes('cancel') || status.message.includes('reject')) {
			waiting = false;
		}
	});
	// tracks current ID and resets if it changes
	let oldId = '';
	$effect(() => {
		if (txId && txId !== untrack(() => oldId)) {
			setStatus('');
			api.setStep(stepsData.length - 1);
			oldId = txId;
		}
	});

	// START TRANSACTION
	function initSend() {
		// For deposit/withdraw: toCoin mirrors fromCoin; toNetwork defaults based on txType.
		// Write resolved values back so send() can read them directly from txState.
		txState.toCoin = txState.toCoin ?? txState.fromCoin;
		txState.toNetwork =
			txState.toNetwork ??
			(txType === 'deposit'
				? Network.magi
				: txType === 'withdraw'
					? Network.hiveMainnet
					: undefined);

		if (!txState.fromCoin || !txState.fromNetwork || !txState.toCoin || !txState.toNetwork) {
			return new Error('Required field undefined.');
		}

		let intermediary = getIntermediaryNetwork(
			{ coin: txState.fromCoin.coin, network: txState.fromNetwork },
			{ coin: txState.toCoin.coin, network: txState.toNetwork }
		);

		// console.log('found intermediary network:', intermediary.label);

		if (intermediary === Network.lightning) {
			setStatus('Generating Lightning transfer');
			openV4V();
			return;
		}

		waiting = true;
		// console.log('waiting for signature');
		send(txState, auth, intermediary, setStatus, abortSend.signal).then((res) => {
			if (res instanceof Error) {
				// log the error if it isn't caught
				console.error(res.message);
			} else {
				txId = res.id;
			}
			waiting = false;
		});
		return;
	}

	// Abort Controls
	const abortSend = new AbortController();
	function cancelTransaction() {
		abortSend.abort();
		waiting = false;
		status = {
			message: 'Transaction canceled by the user',
			isError: true
		};
	}
</script>

{#key sessionId}
	<div
		{...api.getRootProps()}
		data-variant={size}
		class={{ home: onHomePage, 'dialog-content': size === 'dialog' }}
		style="min-height: {minHeight}px;"
	>
		{#each stepsData as step, index}
			{@const Component = step.component}
			{@const activeIsPopup = !!stepsData[api.value]?.popup}
			{@const keepPrevVisible = (() => {
				if (!activeIsPopup) return false;
				if (index >= api.value) return false;
				// Visible if every stage strictly between this and the active one
				// is itself popup — i.e. there's an unbroken popup chain back.
				for (let i = index + 1; i <= api.value; i++) {
					if (!stepsData[i]?.popup) return false;
				}
				return true;
			})()}
			{@const isVisible = api.value === index || keepPrevVisible}
			<div
				{...api.getContentProps({ index })}
				hidden={!isVisible}
				tabindex="-1"
			>
				<Component
					{editStage}
					isActive={api.value === index}
					{status}
					{waiting}
					abort={cancelTransaction}
					{txId}
					popup={!!step.popup}
					next={api.value === index ? next : undefined}
					previous={api.value === index ? previous : undefined}
					goHome={() => {
						setStatus('');
						api.setStep(0);
					}}
					{...extraProps}
					{close}
					bind:onHomePage
					bind:customButtons
				/>
			</div>
		{/each}
		{#if onHomePage && !stepsData[api.value]?.popup}
			<NavButtons {buttons} fixed={size === 'page'} />
		{/if}
	</div>
{/key}

{#if showV4VModal && txState.toCoin && txState.toNetwork && txState.fromAmount}
	{@const toCoin = txState.toCoin}
	{@const toNetwork = txState.toNetwork}
	{@const toAmount = txState.toAmount}

	<V4VPopup
		from={{ coin: Coin.sats, network: Network.lightning }}
		to={{ coin: toCoin.coin, network: toNetwork }}
		{toAmount}
		{auth}
		toUsername={txState.toUsername}
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
							to: txState.toUsername,
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
	[data-part='root'][data-variant='page'] {
		flex-grow: 1;
		overflow-y: auto;
		padding-bottom: 0;
		[data-part='content'] {
			margin: auto;
			padding: 0;
			overflow-y: auto;
		}
		[data-part='list'] {
			position: absolute;
			left: 6.75rem;
			display: flex;
			flex-direction: column;
			font: inherit;
		}
	}
	[data-part='root'][data-variant='dialog'] {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		[data-part='content'] {
			max-width: 32rem;
			min-width: min-content;
		}
	}
	[data-part='content'] {
		cursor: default;
		&:focus-visible {
			outline: none;
		}
	}
	/*
	 * Popup-chain stages: when the active stage is a popup and the
	 * previous page-level stage (e.g. SwapOptions) stays rendered
	 * behind it via `keepPrevVisible`, zag-js sets the previous
	 * panel's data-state to "closed". The page-variant rules above
	 * give the content panel `margin: auto; overflow-y: auto`, which
	 * means the panel sizes to the ACTIVE stage's height — and the
	 * active stage is a popup (in-flow height ~0) — so the
	 * kept-visible panel collapses into a tiny inner-scroll box.
	 *
	 * Override that for closed-but-still-rendered panels: let the
	 * content drive its natural height and drop the nested overflow.
	 */
	[data-part='root'][data-variant='page']
		[data-part='content'][data-state='closed']:not([hidden]) {
		display: block;
		height: auto;
		min-height: auto;
		max-height: none;
		overflow: visible;
		margin: 0;
	}
	@media screen and (max-width: 36rem) {
		[data-part='root'][data-vauriant='dialog'].home {
			padding-bottom: 3rem;
		}
		.dialog-content {
			height: unset;
		}
	}
</style>
