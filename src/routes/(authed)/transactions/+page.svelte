<script>
	import { transactions } from './sampleData';
	import Table from './Table.svelte';
	
</script>

<document:head>
	<title>Transactions</title>
</document:head>

<Table {transactions}></Table>
