<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import StakeUnstakeTabsModal from './StakeUnstakeTabsModal.svelte';
	import ContractUpdatesSection from '$lib/witness/contractUpdates/ContractUpdatesSection.svelte';
	import GovernanceProposals from './GovernanceProposals.svelte';
	import CurrentValidators from './CurrentValidators.svelte';
	import { Notice, PageHeader } from '$lib/ui';

	let auth = $derived(getAuth()());
	// True for Hive logins (and the not-yet-signed-in state); false only for EVM
	// wallets, which can't stake consensus or sign governance votes.
	let canStake = $derived(auth.value == undefined || auth.value.username != undefined);
</script>

<svelte:head>
	<title>Witness Assistant</title>
</svelte:head>

<PageHeader
	title="Witness Assistant"
	spacing="page"
	subtitle="Review pending contract updates, manage your consensus stake, and vote."
	hint="A witness runs a VSC node and takes part in consensus. Staking HIVE puts you in
	      the running for a committee seat; the committee produces blocks and approves
	      changes to the contracts the network runs on."
/>

<div class="page">
	<!-- 1. Contract updates lead. They are the only item on this page with a
	     deadline on it (a 48h timelock runs out whether or not anyone looked),
	     and auditing one is the job a witness is actually here to do. Visible
	     regardless of auth provider, so it sits outside the Hive gate. -->
	<ContractUpdatesSection />

	<!-- 2. The two standing views, side by side: what YOU hold in consensus on
	     the left, what the committee is DOING with it on the right. They are
	     each about half a screen tall, so stacking them pushed the second one
	     below the fold for no reason. Below ~820px they stack. -->
	<div class="cols">
		<div class="col">
			{#if canStake}
				<StakeUnstakeTabsModal />
			{:else}
				<Notice
					tone="warn"
					title="Consensus staking needs a Hive account"
					hint="Consensus stake is a Hive-chain operation signed by the staking account
					      itself, so an EVM wallet has no key that can authorise it. Block production
					      below is read-only and works on any wallet."
				>
					<a href="/logout">Log out</a> and sign in with a Hive account to stake.
				</Notice>
			{/if}
		</div>
		<div class="col">
			<CurrentValidators />
		</div>
	</div>

	<!-- 3. Governance proposals last: dormant until safety slashing activates,
	     so this is usually an empty box and must not lead the page. -->
	{#if canStake}
		<GovernanceProposals />
	{/if}
</div>

<style lang="scss">
	.page {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}
	/* `auto-fit` + a `min()` floor rather than a media query: the floor is what
	   stops a 390px phone getting two 190px columns, and `min(…, 100%)` is what
	   stops the 380px floor itself overflowing a narrower viewport. */
	.cols {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr));
		align-items: start;
		min-width: 0;
	}
	/* Grid items default to `min-width: auto`, so one long unbreakable string
	   (a block number, an @account) would otherwise widen the whole column. */
	.col {
		min-width: 0;
	}
</style>
