<script>
	import { getAuth } from '$lib/auth/store';

	import { transactions } from './sampleData';
	import Table from './Table.svelte';
	let auth = $derived(getAuth()());
	// let transactions = getTransactions(client, auth.did);
</script>

<document:head>
	<title>Transactions</title>
</document:head>

<Table {transactions}></Table>
