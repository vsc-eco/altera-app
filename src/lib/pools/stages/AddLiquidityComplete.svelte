<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import TxDoneFooter from '$lib/sendswap/components/shared/TxDoneFooter.svelte';
	import { liquidityDraftStore } from '$lib/pools/liquidityStore';

	let { txId, onClose = () => {} }: { txId: string; onClose?: () => void } = $props();
</script>

<h2>Liquidity Added</h2>
<Card>
	{#if $liquidityDraftStore.selectedPool}
		<p class="sm-caption">Pool {$liquidityDraftStore.selectedPool.pair}</p>
		<p class="line">{$liquidityDraftStore.amount0Ca.toPrettyString()}</p>
		<p class="line">{$liquidityDraftStore.amount1Ca.toPrettyString()}</p>
	{/if}
	{#if txId}
		<p class="tx">Transaction submitted: {txId}</p>
	{:else}
		<p class="tx">Waiting for transaction confirmation…</p>
	{/if}
</Card>

<TxDoneFooter enabled={!!txId} {onClose} />

<style>
	.sm-caption { color: var(--dash-text-muted); }
	.line { margin: 0.35rem 0; }
	.tx { margin-top: 0.75rem; word-break: break-all; }
</style>

