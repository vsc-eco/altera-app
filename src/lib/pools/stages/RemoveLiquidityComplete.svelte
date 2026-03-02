<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import TxDoneFooter from '$lib/sendswap/components/shared/TxDoneFooter.svelte';
	import { removeLiquidityDraftStore } from '$lib/pools/removeLiquidityStore';

	let { txId, onClose = () => {} }: { txId: string; onClose?: () => void } = $props();
</script>

<h2>Liquidity Removed</h2>
<Card>
	{#if $removeLiquidityDraftStore.selectedPool}
		<p class="sm-caption">Pool {$removeLiquidityDraftStore.selectedPool.pair}</p>
		<p class="line">LP Burned: {$removeLiquidityDraftStore.lpAmount}</p>
	{/if}
	{#if txId}
		<p class="tx">Transaction submitted: {txId}</p>
	{:else}
		<p class="tx">Waiting for transaction confirmation…</p>
	{/if}
</Card>

<TxDoneFooter enabled={!!txId} {onClose} />

<style>
	.sm-caption { color: var(--neutral-fg-mid); }
	.line { margin: 0.35rem 0; }
	.tx { margin-top: 0.75rem; word-break: break-all; }
</style>
