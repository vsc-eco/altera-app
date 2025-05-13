<script lang="ts">
	import type { Auth } from '$lib/auth/store';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import Dialog from '$lib/zag/Dialog.svelte';
	import QR from '$lib/zag/QR.svelte';
	import type { Snippet } from 'svelte';
	import { Coin, type CoinOnNetwork } from './sendOptions';
	import { satsToBtc } from './units';
	import { checkLightningSuccess, createLightningInvoice } from './v4v/v4v';
	let {
		status: statusPromise,
		onerror,
		qrData,
		onsuccess,
		body,
		successMessage,
		errorMessage
	}: {
		successMessage: Snippet;
		errorMessage: Snippet<[string]>;
		body: Snippet<[Snippet]>;
		status: Promise<string | 'success'>;
		qrData: string;
		onerror?: (error: string) => void;
		onsuccess?: () => void;
	} = $props();
	let status: string | undefined = $state();
	$effect(() => {
		statusPromise?.then((statusResult) => {
			status = statusResult;
			if (status != 'success' && onerror) {
				onerror(status);
				return;
			}
			if (onsuccess) onsuccess();
		});
	});
</script>

{#snippet qr()}
	<QR data={qrData}></QR>
{/snippet}

<Dialog defaultOpen={true}>
	{#snippet title()}
		Lightning Transfer (via <a href="https://v4v.app" target="_blank" rel="noreferrer">V4V.app</a>)
	{/snippet}
	{#snippet content()}
		{#if status == undefined}
			{@render body(qr)}
		{:else if status == 'success'}
			{@render successMessage()}
		{:else}
			{@render errorMessage(status)}
		{/if}
	{/snippet}
</Dialog>
