<script>
	import Send from '$lib/send/SendCards.svelte';
</script>

<document:head>
	<title>Swap</title>
</document:head>
<h1>Swap</h1>
<div class="send-wrapper">
	<Send hideToUsername></Send>
</div>

<style>
	.send-wrapper {
		width: 100%;
	}
	.send-wrapper :global(*) {
		max-width: 42rem;
	}
</style>