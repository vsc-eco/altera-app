<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Balance from '$lib/cards/Balance/Balance.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import { actions } from '../quickActions';
	import { getAccountNameFromAuth } from '$lib/getAccountName';
	import DepositModal from './witness-assistant/DepositModal.svelte';
	import Send from '$lib/send/Send.svelte';
	import Card from '$lib/cards/Card.svelte';
	import Table from './transactions/Table/Table.svelte';
	import AccBalance from '$lib/AccBalance.svelte';
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

<div class="action-bar">
	{#each actions as action}
		<PillBtn {...'styling' in action ? action.styling : {}} href={action.href}>
			{@const Icon = action.icon}
			<Icon />
			{action.label}
		</PillBtn>
	{/each}
</div>
<div class="masonry">
	<Balance></Balance>
	{#if auth.value}
		<Card>
			<AccBalance did={auth.value.did}></AccBalance>
		</Card>
	{/if}
	<Card>
		<Send widgetView />
	</Card>
	{#if auth.value == undefined || auth.value.username != undefined}
		<DepositModal />
	{/if}
	<div class="txs">
		<h3>Transactions</h3>
		{#if auth.value}
			<Table did={auth.value.did} />
		{/if}
	</div>
</div>

<style>
	.masonry {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: stretch;
	}
	.masonry > .txs {
		flex-basis: 100%;
		width: 100%;
	}
	.masonry > :global(*) {
		flex-grow: 1;
		flex-basis: 300px;
	}
	h1 {
		font-size: var(--text-4xl);
		margin: calc(var(--text-4xl) / 2) 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
	}
	.action-bar {
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		height: 3.5rem;
		white-space: nowrap;
		position: relative;
	}
	.action-bar::after {
		content: '';
		position: sticky;
		display: block;
		left: calc(100% - 32px);
		bottom: 0;
		width: 32px;
		height: 3rem;
		background: linear-gradient(90deg, transparent, var(--neutral-bg));
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
