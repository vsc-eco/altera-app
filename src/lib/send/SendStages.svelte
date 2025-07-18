<script lang="ts">
	import Recipient from './stages/recipient/Recipient.svelte';
	import SendTitle from './navigation/SendTitle.svelte';
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import { onMount } from 'svelte';
	import { Coin, Network, type CoinOptions, type NecessarySendDetails, type SendDetails } from './sendOptions';
	import { goto } from '$app/navigation';
	import SendBottomButtons from './navigation/SendNavButtons.svelte';
	import Amount from './stages/amount/Amount.svelte';
	import Review from './stages/review/Review.svelte';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import V4VPopup from './V4VPopup.svelte';
	import { getIntermediaryNetwork } from './getNetwork';
	import { authStore, type Auth } from '$lib/auth/store';
	import { send } from './sendUtils';
	import NetworkInfo from './stages/NetworkInfo.svelte';

	let auth = $authStore;
	let windowWidth = $state(0);
	let remValue = $state(0);
	let currentTab = $state('recipient');
	onMount(() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	});
	// size of content + 2 * (space for tabs + buffer)
	const showTabs = $derived(windowWidth > 42 * remValue + 2 * (6.75 * remValue + 106 + 10));

	let error = $state('');
	let status = $state('');
	let details: SendDetails = $state({
		fromCoin: undefined,
		fromNetwork: undefined,
		fromAmount: '0',
		toCoin: undefined,
		toNetwork: undefined,
		toUsername: '',
		toDisplayName: '',
		method: undefined,
		account: undefined
	});

	const tabItems = [
		{ value: 'recipient', label: 'Recipient', content: recipient },
		{ value: 'amount', label: 'Amount', content: amount },
		{ value: 'review', label: 'Review', content: review }
	];

	const id = getUniqueId();
	const service = useMachine(tabs.machine, {
		id,
		orientation: 'vertical',
		get value() {
			return currentTab;
		},
		onValueChange: (details) => {
			currentTab = details.value;
		}
	});

	const api = $derived(tabs.connect(service, normalizeProps));

	function advanceTab() {
		const currentIndex = tabItems.findIndex((item) => item.value === currentTab);
		const nextIndex = currentIndex + 1;
		// change action for last tab
		if (nextIndex === tabItems.length - 1) {
			buttons.fwd.label = 'Send';
		}
		if (currentIndex === tabItems.length - 1) {
			initSwap();
			return;
		}
		currentTab = tabItems[nextIndex].value;
	}
	function backTab() {
		const currentIndex = tabItems.findIndex((item) => item.value === currentTab);
		if (currentIndex === 0) {
			goto('/');
			return;
		}
		if (currentIndex === tabItems.length - 1) {
			buttons.fwd.label = 'Next';
		}
		const prevIndex = currentIndex - 1;
		currentTab = tabItems[prevIndex].value;
	}
	let buttons = $state({
		fwd: {
			label: 'Next',
			action: advanceTab
		},
		back: {
			label: 'Back',
			action: backTab
		}
	});
	let showV4VModal = $state.raw(false);
	function isLikelyProxy(obj: any): boolean {
		if (!obj || typeof obj !== 'object') return false;
		try {
			Object.getOwnPropertyDescriptors(obj);
			return false;
		} catch {
			return true;
		}
	}
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
		const { fromCoin, fromNetwork, fromAmount: amount, toCoin, toNetwork, toUsername } = $state.snapshot(details) as SendDetails;

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
</script>

<svelte:window
	bind:innerWidth={windowWidth}
	on:resize={() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	}}
/>

{#snippet recipient()}
	<Recipient bind:details />
{/snippet}
{#snippet amount()}
	<Amount bind:details />
{/snippet}
{#snippet review()}
	<Review bind:details {status} />
{/snippet}

<SendTitle close={() => goto('/')} />

<div {...api.getRootProps()}>
	{#if showTabs}
		<div {...api.getListProps()}>
			{#each tabItems as item}
				<button {...api.getTriggerProps({ value: item.value })}>
					<span>{item.label}</span>
				</button>
			{/each}
			<div {...api.getIndicatorProps()}></div>
		</div>
	{/if}
	<form
		class={{ complete: false }}
		onsubmit={() => {
			initSwap();
		}}
		id="send"
	>
		{#each tabItems as item}
			<div {...api.getContentProps({ value: item.value })}>
				{@render item.content()}
			</div>
		{/each}
	</form>
</div>
<SendBottomButtons {buttons} />

{#if showV4VModal && details.toCoin && details.toNetwork && details.fromAmount}
	{@const toCoin = details.toCoin}
	{@const toNetwork = details.toNetwork}
	{@const toAmount = details.fromAmount}

	<V4VPopup
		from={{ coin: Coin.sats, network: Network.lightning }}
		to={{ coin: toCoin.coin, network: toNetwork }}
		{toAmount}
		{auth}
		toUsername={details.toUsername}
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
							to: details.toUsername,
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

		span {
			text-wrap: nowrap;
			box-sizing: border-box;
			text-decoration: none;
		}

		&:hover {
			border-color: var(--neutral-bg-accent-shifted);
		}
		&[data-selected] {
			border-color: var(--accent-mid);
			&:hover {
				cursor: default;
			}
		}
	}
	[data-part='content'] {
		height: 100%;
	}
	form {
		margin: auto;
		margin-top: 3rem;
		max-width: 42rem;
		height: 100%;
	}
</style>
