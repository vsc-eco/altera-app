<script lang="ts">
	import { getUniqueId } from '$lib/zag/idgen';
	import * as tabs from '@zag-js/tabs';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import WithdrawModal from './ConsensusUnstakeModal.svelte';
	import DepositModal from './ConsensusStakeModal.svelte';
	import Card from '$lib/cards/Card.svelte';
	import Tabs from '$lib/zag/Tabs.svelte';

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

<Card>
	<Tabs items={data}></Tabs>
</Card>
