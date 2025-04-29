<script lang="ts">
	import type { Network } from '$lib/send/sendOptions';
	import type { UnkCoinAmount } from './CoinAmount';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';

	type Props = { network: Network } & { amount: UnkCoinAmount };
	let { amount, network }: Props = $props();
	let renderedAmount = $derived(amount.toPrettyAmountString());
</script>

<span class="nobreak"
	><CoinNetworkIcon {network} coin={amount.coin} />&nbsp;<span class="mono"
		>{amount.toPrettyAmountString()}</span
	>&nbsp;<span class="mono">{amount.coin.unit}</span></span
>

<style>
	.nobreak {
		white-space: nowrap;
	}
</style>
