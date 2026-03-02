<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import moment from 'moment';
	import TxStatus from '$lib/sendswap/components/shared/TxStatus.svelte';
	import { getAuth } from '$lib/auth/store';
	import { removeLiquidityDraftStore } from '$lib/pools/removeLiquidityStore';

	let {
		editStage,
		status,
		waiting = false,
		abort = () => {}
	}: {
		editStage: (complete: boolean) => void;
		status: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
	} = $props();

	const auth = $derived(getAuth()());
	let today = moment().format('MMM D, YYYY');

	$effect(() => {
		editStage(true);
	});
</script>

<h2>Review</h2>
<Card>
	{#if $removeLiquidityDraftStore.selectedPool}
		<ul>
			<li><span class="sm-caption">Action</span><span class="content">Remove Liquidity</span></li>
			<li>
				<span class="sm-caption">Pool</span>
				<span class="content">{$removeLiquidityDraftStore.selectedPool.pair}</span>
			</li>
			<li>
				<span class="sm-caption">LP Amount</span>
				<span class="content">{$removeLiquidityDraftStore.lpAmount}</span>
			</li>
			<li><span class="sm-caption">Initiated On</span><span class="content">{today}</span></li>
		</ul>
	{:else}
		<p>No pool selected.</p>
	{/if}
</Card>

<TxStatus
	{status}
	{waiting}
	{abort}
	showHiveWarning={auth.value?.provider === 'aioha'}
/>

<style>
	ul { list-style: none; padding: 0; margin: 0; }
	li { display: flex; gap: 1rem; padding: 0.75rem 0.5rem; }
	li:not(:last-child) { border-bottom: 1px solid var(--neutral-bg-accent); }
	.sm-caption { width: min(12rem, 40%); color: var(--neutral-fg-mid); }
</style>
