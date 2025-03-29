<script lang="ts">
	import type { Auth } from '$lib/auth/store';
	import Dialog from '$lib/zag/Dialog.svelte';
	import QR from '$lib/zag/QR.svelte';
	import type { CoinOnNetwork } from './sendOptions';
	import { satsToBtc } from './units';
	import { createLightningInvoice } from './v4v/v4v';
	let {
		to,
		toAmount,
		auth
	}: { from: CoinOnNetwork; to: CoinOnNetwork; toAmount: string; auth: Auth } = $props();
	let data = createLightningInvoice(
		toAmount,
		to.coin.label as 'hive' | 'hbd',
		to.coin.label as 'hive' | 'hbd',
		to.network,
		auth
	);
	data.then((res) => {
		console.log(res);
		toggle(true);
	});
	let toggle: (open?: boolean) => void = $state(() => {});
</script>

{#await data then res}
	<Dialog bind:toggle defaultOpen={true}>
		{#snippet title()}
			Lightning Transfer (via <a href="https://v4v.app">V4V.app</a>)
		{/snippet}
		{#snippet content()}
			{#if typeof res == 'string'}
				<p class="error">Error: {res}</p>
			{:else}
				<QR data={res.qr_data}></QR>
				<p>Scan the above to send {satsToBtc(Number(res.amount))} BTC to V4V</p>
			{/if}
		{/snippet}
	</Dialog>
{/await}
