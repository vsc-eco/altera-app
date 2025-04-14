<script>
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import Table from './Table/Table.svelte';
	// TODO: comment out the following lines:
	// import { getAuth } from '$lib/auth/store';
	// let auth = $derived(getAuth()());
	// let did = $derived(auth.value?.did);
	let did = 'hive:tibfox.vsc';
	// let transactions = getTransactions(client, auth.did);
</script>

<document:head>
	<title>Transactions</title>
</document:head>
<div class="flex">
	<h1>Transactions involving {getAccountNameFromDid(did)}</h1>
	{#if did}
		<Table {did}></Table>
	{/if}
</div>

<style>
	.flex {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 3.5rem);
	}
</style>
