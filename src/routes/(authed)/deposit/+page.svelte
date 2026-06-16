<script lang="ts">
	import DepositPage from '$lib/sendswap/DepositPage.svelte';
</script>

<document:head>
	<title>Deposit</title>
</document:head>

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
