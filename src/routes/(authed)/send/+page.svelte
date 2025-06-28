<script>
	import Send from '$lib/send/Send.svelte';
</script>

<document:head>
	<title>Send</title>
</document:head>
<h1>Send</h1>
<div class="send-wrapper">
	<Send></Send>
</div>

<style>
	.send-wrapper {
		width: 100%;
	}
	.send-wrapper :global(*) {
		max-width: 42rem;
	}
</style>