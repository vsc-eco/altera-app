<script lang="ts">
	import { getUniqueId } from '$lib/zag/idgen';
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import WithdrawModal from './ConsensusUnstakeModal.svelte';
	import DepositModal from './ConsensusStakeModal.svelte';
	import Card from '$lib/cards/Card.svelte';
	import Tabs from '$lib/zag/Tabs.svelte';
	import { Coins } from '@lucide/svelte';
	import { Hint } from '$lib/ui';

	const data = [
		{ value: 'stake', label: 'Stake', content: deposit },
		{ value: 'unstake', label: 'Unstake', content: withdraw }
	];

	const id = $props.id();
	const service = useMachine(tabs.machine, {
		id: getUniqueId(),
		defaultValue: 'stake'
	});

	const api = $derived(tabs.connect(service, normalizeProps));
</script>

{#snippet deposit()}
	<DepositModal></DepositModal>
{/snippet}
{#snippet withdraw()}
	<WithdrawModal></WithdrawModal>
{/snippet}

<!--
	The card owns the title, not the two tab panels. They used to carry an h2
	each ("Consensus Staking" / "Consensus Unstaking") plus the same tooltip
	text twice, which made the heading jump as you switched tab and left the
	card looking nothing like its neighbour (Block production) in the column
	beside it. One head, one explanation, and the tab row says which of the two
	you are doing.
-->
<Card>
	<div class="head">
		<h3><Coins size={18} /> Consensus stake</h3>
		<Hint size={16}>
			Staking locks HIVE into VSC consensus and puts your account in the running for a committee
			seat. Unstaking has a cooldown of about a day before the HIVE returns to your liquid
			balance. Only Hive accounts can stake.
			<a href="https://docs.magiprotocol.com" target="_blank" rel="noopener">Learn more →</a>
		</Hint>
	</div>
	<Tabs items={data}></Tabs>
</Card>

<style lang="scss">
	.head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.85rem;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.05rem;
		font-family: 'Nunito Sans', sans-serif;
	}
</style>
