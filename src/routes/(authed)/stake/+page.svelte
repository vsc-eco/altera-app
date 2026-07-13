<script lang="ts">
	import HbdStakePage from '$lib/sendswap/HbdStakePage.svelte';
</script>

<document:head>
	<title>Stake HBD</title>
</document:head>

<div class="stake-route">
	<HbdStakePage />
</div>

<style lang="scss">
	.stake-route {
		display: flex;
		flex-direction: column;
		/* No height constraint: the timeline grows naturally and the document
		   scrolls, instead of trapping the flow in an inner scrollbox. */
	}
</style>
