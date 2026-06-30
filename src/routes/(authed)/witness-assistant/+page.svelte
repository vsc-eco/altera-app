<script>
	import ConsensusStakeModal from './ConsensusStakeModal.svelte';
	import ConsensusUnstakeModal from './ConsensusUnstakeModal.svelte';
	import { getAuth } from '$lib/auth/store';
	import StakeUnstakeTabsModal from './StakeUnstakeTabsModal.svelte';
	import ContractUpdatesSection from '$lib/witness/contractUpdates/ContractUpdatesSection.svelte';
	import GovernanceProposals from './GovernanceProposals.svelte';
	import CurrentValidators from './CurrentValidators.svelte';
	let auth = $derived(getAuth()());
	// True for Hive logins (and the not-yet-signed-in state); false only for EVM
	// wallets, which can't stake consensus or sign governance votes.
	let canStake = $derived(auth.value == undefined || auth.value.username != undefined);
</script>

<document:head>
	<title>Witness Assistant</title>
</document:head>

<h1>Witness Assistant</h1>

<div>
	<!-- 0. Current validators — a small live-ish box of the committee securing the
	     network this epoch. Read-only, visible to everyone, so it leads the page. -->
	<CurrentValidators />

	<!-- 1. Stake / Unstake — the primary witness action (and the prerequisite to
	     voting), so it leads. EVM wallets can't stake → show the redirect notice. -->
	{#if canStake}
		<StakeUnstakeTabsModal />
	{:else}
		<p class="error">
			Consensus staking with an EVM wallet is unsupported. Please <a href="/logout">logout</a> and login
			with a hive account instead.
		</p>
	{/if}

	<!-- 2. Contract updates — auditing pending changes; visible regardless of auth
	     provider, so it sits outside the Hive gate. -->
	<ContractUpdatesSection />

	<!-- 3. Governance proposals — open reserve/slash votes (Hive witnesses only).
	     Last because it's dormant until safety slashing activates (usually empty). -->
	{#if canStake}
		<GovernanceProposals />
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
