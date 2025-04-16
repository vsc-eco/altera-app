<script lang="ts">
	import type { CoinOnNetwork } from '$lib/send/sendOptions';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';

	type Props = CoinOnNetwork & { amount: number | string };
	let { amount, network, coin }: Props = $props();
	let renderedAmount = $derived(
		typeof amount == 'string'
			? amount
			: new Intl.NumberFormat('en-US', {
					style: 'decimal',
					maximumFractionDigits: 8
				}).format(amount)
	);
</script>

<span class="nobreak"
	><CoinNetworkIcon {network} {coin} />&nbsp;<span class="mono">{amount}</span>&nbsp;<span
		class="mono">{coin.unit}</span
	></span
>

<style>
	.nobreak {
		white-space: nowrap;
	}
	.mono {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 500;
	}
</style>
