<script>
	import SendCards from '$lib/send/SendCards.svelte';
	import SendStages from '$lib/send/SendStages.svelte';
</script>

<document:head>
	<title>Send</title>
</document:head>
<!-- <div class="send-wrapper">
	<SendCards/>
</div> -->
<div class="send-wrapper">
	<SendStages/>
</div>

<style>
	.send-wrapper {
		width: 100%;
	}
</style>