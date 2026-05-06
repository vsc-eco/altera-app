<script lang="ts">
	import { getAccountNameFromAuth, getAccountNameFromDid } from '$lib/getAccountName';
	import { page } from '$app/state';
	import Table from './Table/Table.svelte';
	import { getAuth } from '$lib/auth/store';
	import { goto } from '$app/navigation';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
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
	<h1>Transactions involving {did ? getAccountNameFromDid(did) : '0xd072...AdAA'}</h1>
	{#if did}
		<Table {did} initialOpen={autoOpenOp}></Table>
	{/if}
</div>

<style>
	h1 {
		display: flex;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
	}
	.flex {
		display: flex;
		flex-direction: column;
		/* No fixed height — table sizes to its content so there's no blank
		   space when only a few transactions are loaded. The page scrolls
		   naturally for larger transaction sets. */
		/* height: calc(100vh - 6.5rem); */
	}
</style>
