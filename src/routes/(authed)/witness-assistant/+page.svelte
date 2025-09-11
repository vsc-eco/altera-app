<script>
	import ConsensusStakeModal from './ConsensusStakeModal.svelte';
	import ConsensusUnstakeModal from './ConsensusUnstakeModal.svelte';
	import { getAuth } from '$lib/auth/store';
	import StakeUnstakeTabsModal from './StakeUnstakeTabsModal.svelte';
	let auth = $derived(getAuth()());
</script>

<document:head>
	<title>Witness Assistant</title>
</document:head>

<h1>Witness Assistant</h1>

<div>
	{#if auth.value == undefined || auth.value.username != undefined}
		<StakeUnstakeTabsModal />
	{:else}
		<p class="error">
			Consensus staking with an EVM wallet is unsupported. Please <a href="/logout">logout</a> and login
			with a hive account instead.
		</p>
	{/if}
</div>

<style>
	div {
		display: grid;
		gap: 1rem;
	}
</style>
