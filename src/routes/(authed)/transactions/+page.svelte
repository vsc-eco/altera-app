<script>
	import { getAuth } from '$lib/auth/store';

	import { GetTransactionsStore } from '$houdini';
	import Table from './Table.svelte';
	// GetTransactions
	let store = $derived(new GetTransactionsStore());
	$effect(() => store.setup(true));
	let auth = $derived(getAuth()());
	// let transactions = getTransactions(client, auth.did);
</script>

<document:head>
	<title>Transactions</title>
</document:head>
{#if auth.value}
	{@const transactionsQuery = store.fetch({
		variables: {
			limit: 10,
			// did: auth.value.did,
			did: 'hive:vaultec',
			offset: 0
		}
	})}
	<Table transactions={transactionsQuery}></Table>
{/if}
