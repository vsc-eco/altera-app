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
	import { send } from './sendUtils';
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { SendTxDetails } from './sendUtils';
	import { goto } from '$app/navigation';
	import Card from '$lib/cards/Card.svelte';
	import Complete from './stages/complete/Complete.svelte';

	let auth = $authStore;
	let windowWidth = $state(0);
	let remValue = $state(0);

	onMount(() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	});
	// size of content + 2 * (space for tabs + buffer)
	const showTabs = $derived(windowWidth > 42 * remValue + 2 * (6.75 * remValue + 106 + 10));

	let error = $state('');
	let status = $state('');

	const stepsData = [
		{ value: 'recipient', label: 'Recipient', content: recipient },
		{ value: 'amount', label: 'Amount', content: amount },
		{ value: 'review', label: 'Review', content: review },
		{ value: 'complete', label: 'Review', content: complete }
	];

	const id = getUniqueId();

	const service = useMachine(steps.machine, {
		id,
		orientation: 'vertical',
		// linear: true,
		count: stepsData.length - 1,
		onStepChange: (details) => {}
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
	function setStatus(s: string) {
		status = s;
	}
	function initSwap() {
		console.log('in initSwap');
		const {
			fromCoin,
			fromNetwork,
			fromAmount: amount,
			toCoin,
			toNetwork,
			toUsername
		} = $SendTxDetails;

		if (!fromCoin || !fromNetwork || !toCoin || !toNetwork) {
			return new Error('Required field undefined.');
		}

		console.log('fields', fromCoin, fromNetwork, toCoin, toNetwork);

		const importantDetails: NecessarySendDetails = {
			fromCoin,
			fromNetwork,
			amount,
			toCoin,
			toNetwork,
			toUsername
		};

		let intermediary = getIntermediaryNetwork(
			{ coin: fromCoin.coin, network: fromNetwork },
			{ coin: toCoin.coin, network: toNetwork }
		);

		console.log('intermediary', intermediary);

		if (intermediary === Network.lightning) {
			openV4V();
			return;
		}

		send(importantDetails, auth, intermediary, setStatus).then((res) => {
			if (res instanceof Error) {
				console.error(res.message);
			} else {
				console.log('id:', res.id);
			}
		});
		return;
	}
	let stage = new Set<string>();
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
	
	const nextLabel = $derived(api.value === stepsData.length - 1 ? 'Send' : 'Next');
</script>

<svelte:window
	bind:innerWidth={windowWidth}
	on:resize={() => {
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
{#snippet review(value: string)}
	<Review id={value} {editStage} {status} />
{/snippet}
{#snippet complete(value: string)}
	<Complete /> 
{/snippet}

<SendTitle close={() => goto('/')} />

<div {...api.getRootProps()}>
	{#if showTabs}
		<div {...api.getListProps()}>
			{#each stepsData as step, index}
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
	<div class="nav-bar">
		<div class="nav-buttons">
			<PillButton {...api.getPrevTriggerProps() as ButtonAttributes} styleType="outline"
				>Back</PillButton
			>
			<!-- {#if stepComplete} -->
			<PillButton
				{...api.getNextTriggerProps() as ButtonAttributes}
				styleType="invert"
				theme="accent"
				disabled={!stepComplete}
			>
				{nextLabel}
			</PillButton>
			<!-- {:else}
				<PillButton onclick={() => (violation = true)} styleType="invert" theme="accent">
					{nextLabel}
				</PillButton>
			{/if} -->
		</div>
	</div>
</div>

{#if showV4VModal && $SendTxDetails.toCoin && $SendTxDetails.toNetwork && $SendTxDetails.fromAmount}
	{@const toCoin = $SendTxDetails.toCoin}
	{@const toNetwork = $SendTxDetails.toNetwork}
	{@const toAmount = $SendTxDetails.fromAmount}

	<V4VPopup
		from={{ coin: Coin.sats, network: Network.lightning }}
		to={{ coin: toCoin.coin, network: toNetwork }}
		{toAmount}
		{auth}
		toUsername={$SendTxDetails.toUsername}
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
			setTimeout(() => {
				showV4VModal = false;
			}, 10000);
		}}
	/>
{/if}

<style lang="scss">
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
		margin-top: 3rem;
		max-width: 42rem;
		height: 100%;
		min-height: 77vh;
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
</style>
