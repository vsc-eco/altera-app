<script lang="ts">
	import WithdrawPage from '$lib/sendswap/WithdrawPage.svelte';
</script>

<svelte:head>
	<title>Withdraw</title>
</svelte:head>

<div class="withdraw-route">
	<WithdrawPage />
</div>

<style lang="scss">
	.withdraw-route {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
</style>
