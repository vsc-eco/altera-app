<script lang="ts">
	import { getAccountNameFromAuth, getAccountNameFromDid } from '$lib/getAccountName';
	import { page } from '$app/state';
	import Table from './Table/Table.svelte';
	import { getAuth } from '$lib/auth/store';
	import { goto } from '$app/navigation';
	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);
	// let did = 'hive:techcoderx';
	const autoOpenOp: [string, number] | undefined = $derived.by(() => {
		const autoOpenTxId = page.url.searchParams.get('tx');
		const autoOpenIndex = Number(page.url.searchParams.get('index'));
		if (autoOpenTxId) {
			return [autoOpenTxId, autoOpenIndex];
		}
		return undefined;
	});

	$effect(() => {
		if (autoOpenOp) {
			goto(page.url.pathname, { replaceState: true });
		}
	});
</script>

<document:head>
	<title>Transactions</title>
</document:head>
<div class="flex">
	{#if did}
		<h1>Transactions involving {getAccountNameFromDid(did)}</h1>
		<Table {did} initialOpen={autoOpenOp}></Table>
	{/if}
</div>

<style>
	.flex {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 4.5rem);
	}
</style>
