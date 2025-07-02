<script>
	import DepositModal from './ConsensusStakeModal.svelte';
	import WithdrawModal from './ConsensusUnstakeModal.svelte';
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
