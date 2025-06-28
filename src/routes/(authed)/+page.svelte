<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Balance from '$lib/cards/Balance/Balance.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import TopHomeMenu from './TopHomeMenu.svelte';
	import { actions } from '../quickActions';
	import { getAccountNameFromAuth, getDidFromUsername } from '$lib/getAccountName';
	import StakeUnstakeTabsModal from './witness-assistant/StakeUnstakeTabsModal.svelte';
	import Send from '$lib/send/Send.svelte';
	import Card from '$lib/cards/Card.svelte';
	import Table from './transactions/Table/Table.svelte';
	import AccBalance from '$lib/AccBalance.svelte';
	import ResourceCredits from '$lib/cards/ResourceCredits/ResourceCredits.svelte';
	// let { auth }: LayoutData = $props();
	let auth = $derived(getAuth()());
	let username: string | undefined = $derived(getAccountNameFromAuth(auth));
</script>

<document:head>
	<title>Home</title>
</document:head>

<h1>
	Welcome,
	<span class={['name', { loaded: !!username }]}>
		{#if username}{username}{:else}&nbsp;{/if}
	</span>
</h1>

<TopHomeMenu {auth} />
<div class="masonry">
	<div class="row large">
		<Balance></Balance>
		{#if auth.value}
			<Card>
				<AccBalance did={auth.value.did}></AccBalance>
			</Card>
		{/if}
	</div>
	<div class="row small">
		{#if auth.value}
			<ResourceCredits
				{username}
				isHive={auth.value == undefined || auth.value!.username != undefined}
			/>
		{/if}
	</div>
	<div class="row large">
		{#if auth.value == undefined || auth.value.username != undefined}
			<StakeUnstakeTabsModal />
		{/if}
		<Card>
			<Send widgetView />
		</Card>
	</div>

	<div class="txs">
		<h3>Transactions</h3>
		{#if auth.value}
			<Table did={auth.value.did} allowPopup={false} />
		{/if}
	</div>
</div>

<style>
	.masonry {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.txs {
		flex-basis: 100%;
		width: 100%;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: stretch;
	}
	.row > :global(*) {
		flex-grow: 1;
		flex-basis: 300px;
		box-sizing: border-box;
	}
	.row.small > :global(*) {
		max-width: max(300px, min(calc(64rem / 3), (100% - 1rem) / 2));
	}
	/* This is the width others shrink to 1 col, but not ideal to hard code it */
	@media (max-width: 848px) {
		.row.small > :global(*) {
			flex-grow: 1;
			max-width: none;
			flex-basis: 100%;
		}
	}
	h1 {
		font-size: var(--text-4xl);
		margin: calc(var(--text-4xl) / 2) 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
	}
	.name {
		width: 100%;
		max-width: min(100%, 17ch);
		min-width: fit-content;
		display: inline-flex;
		justify-content: left;
		border-radius: 0.5rem;

		padding: 0.25rem 0.25rem;
		color: transparent;
		background-color: var(--neutral-bg-accent);
		transition:
			background-color 0.5s 0.3s ease-out,
			color 0.5s ease-in;
	}
	.name.loaded {
		width: fit-content;
		color: currentColor;
		background-color: transparent;
	}
</style>
