<script lang="ts">
	import DepositPage from '$lib/sendswap/DepositPage.svelte';
</script>

<svelte:head>
	<title>Wallet · Deposit</title>
</svelte:head>

<div class="deposit-route">
	<DepositPage />
</div>

<style lang="scss">
	.deposit-route {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
</style>
