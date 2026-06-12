<script>
	import ConsensusStakeModal from './ConsensusStakeModal.svelte';
	import ConsensusUnstakeModal from './ConsensusUnstakeModal.svelte';
	import { getAuth } from '$lib/auth/store';
	import StakeUnstakeTabsModal from './StakeUnstakeTabsModal.svelte';
	import ContractUpdatesSection from '$lib/witness/contractUpdates/ContractUpdatesSection.svelte';
	let auth = $derived(getAuth()());
</script>

<document:head>
	<title>Witness Assistant</title>
</document:head>

<h1>Witness Assistant</h1>

<div>
	<!-- Contract updates — visible regardless of auth provider, since
	     auditing pending changes doesn't require a Hive account. -->
	<ContractUpdatesSection />

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
	:global(h1) {
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
</style>
