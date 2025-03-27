<script>
	import Table from './Table.svelte';
	// TODO: comment out the following lines:
	// import { getAuth } from '$lib/auth/store';
	// let auth = $derived(getAuth()());
	// let did = $derived(auth.value?.did);
	let did = 'hive:vaultec';
	// let transactions = getTransactions(client, auth.did);
</script>

<document:head>
	<title>Transactions</title>
</document:head>
{#if did}
	<Table {did}></Table>
{/if}
