<script>
	import DepositModal from './DepositModal.svelte';
	import WithdrawModal from './WithdrawModal.svelte';
</script>

<document:head>
	<title>Witness Assistant</title>
</document:head>

<h1>Witness Assistant</h1>

<div>
	<DepositModal />
	<WithdrawModal />
</div>

<style>
	div {
		display: grid;
		gap: 1rem;
	}
</style>
