<script lang="ts">
	import { Network } from '$lib/send/sendOptions';
	import { getRecipientNetworks } from '$lib/send/sendUtils';
	import { getDidFromUsername } from '$lib/getAccountName';
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { networkCard } from '../components/CardSnippets.svelte';
	import { untrack } from 'svelte';
	import ListBox from '$lib/zag/ListBox.svelte';

	let { close }: { close: () => void } = $props();

	let tmpNetwork: Network | undefined = $state();
	let tmpNetworkVal: string | undefined = $state($SendTxDetails.toNetwork?.value);
	const availableNetworks = $derived(
		getRecipientNetworks(getDidFromUsername($SendTxDetails.toUsername))
	);

	function updateDetails(val: string) {
		tmpNetwork = availableNetworks.find((net) => net.value === val);
		if (!tmpNetwork) return;
		if ($SendTxDetails.toNetwork?.value === tmpNetwork?.value) return;
		$SendTxDetails.toNetwork = tmpNetwork;
		close();
	}

	$effect(() => {
		if (tmpNetworkVal) {
			untrack(() => {
				updateDetails(tmpNetworkVal!);
			});
		}
	});

	let items: {
		label: string;
		value: string;
		snippet: typeof networkCard;
		snippetData: typeof networkCard.arguments;
	}[] = $derived(
		availableNetworks.map((v) => {
			return {
				...v,
				snippet: networkCard,
				snippetData: {
					net: v,
					size: 'medium'
				}
			};
		})
	);
</script>

<div class="dialog-content">
	<h5>Select a Network</h5>
	<ListBox {items} bind:value={tmpNetworkVal} input={false} />
</div>
