<script lang="ts">
	import Recipient from './stages/recipient/Recipient.svelte';
	import SendTitle from './navigation/SendTitle.svelte';
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import { onMount } from 'svelte';
	import type { SendDetails } from './sendOptions';
	import { goto } from '$app/navigation';
	import SendBottomButtons from './navigation/SendNavButtons.svelte';
	import Amount from './stages/amount/Amount.svelte';

	let windowWidth = $state(0);
	let remValue = $state(0);
	let currentTab = $state('recipient');
	onMount(() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	});
	// size of content + 2 * (space for tabs + buffer)
	const showTabs = $derived(windowWidth > 42 * remValue + 2 * (6.75 * remValue + 106 + 10));

	let details: SendDetails = $state({
		fromCoin: undefined,
		fromNetwork: undefined,
		fromAmount: '0',
		toCoin: undefined,
		toNetwork: undefined,
		toUsername: '',
		toDisplayName: '',
		method: undefined
	});

	const tabItems = [
		{ value: 'recipient', label: 'Recipient', content: recipient },
		{ value: 'amount', label: 'Amount', content: amount }
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
	function initSwap(e: Event) {
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
		onsubmit={(e) => {
			initSwap(e);
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
