<script>
	import Send from '$lib/send/SendCards.svelte';
	import Swap from '$lib/swap/Swap.svelte';
</script>

<document:head>
	<title>Send</title>
</document:head>

<div class="swap-wrapper">
	<Swap />
</div>

<style>
	.swap-wrapper {
		width: 100%;
	}
</style>
