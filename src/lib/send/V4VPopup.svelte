<script lang="ts">
	import type { Auth } from '$lib/auth/store';
	import Dialog from '$lib/zag/Dialog.svelte';
	import QR from '$lib/zag/QR.svelte';
	import type { CoinOnNetwork } from './sendOptions';
	import { satsToBtc } from './units';
	import { checkLightningSuccess, createLightningInvoice } from './v4v/v4v';
	let {
		to,
		toAmount,
		auth,
		onerror,
		onsuccess
	}: {
		from: CoinOnNetwork;
		to: CoinOnNetwork;
		toAmount: string;
		auth: Auth;
		onerror?: (error: string) => void;
		onsuccess?: () => void;
	} = $props();
	let invoiceReq = $derived(
		createLightningInvoice(
			toAmount,
			to.coin.label as 'hive' | 'hbd',
			to.coin.label as 'hive' | 'hbd',
			to.network,
			auth
		)
	);
	let invoice:
		| {
				invoice_id: string;
				qr_data: string;
				amount: string;
		  }
		| undefined = $state();
	$effect(() => {
		invoiceReq.then((v) => {
			if (typeof v == 'string') {
				onerror && onerror(v);
				toggle(false);
			} else {
				invoice = v;
			}
		});
	});
	let validateRes = $state();
	let lightningAbort = new AbortController();
	let dialogOpen = $state(true);
	$inspect(dialogOpen);
	$effect(() => {
		if (!dialogOpen) {
			if (onerror) onerror('Error: Lightning dialog closed before transaction could succeed.');
			lightningAbort.abort('Error: Lightning dialog closed before transaction could succeed.');
		}
	});
	$effect(() => {
		lightningAbort.abort();
		if (!invoice) return;
		lightningAbort = new AbortController();
		const validateReq = checkLightningSuccess(invoice.invoice_id, {
			signal: lightningAbort.signal
		});
		validateReq.then((res) => {
			if (res != undefined) validateRes = res;
			if (validateRes == 'success' && onsuccess) onsuccess();
			if (validateRes != 'success' && onerror) onerror(res!);
		});
		return lightningAbort.abort;
	});
	let toggle: (open?: boolean) => void = $state(() => {});
</script>

{#await invoiceReq then res}
	<Dialog bind:toggle bind:open={dialogOpen} defaultOpen={true}>
		{#snippet title()}
			Lightning Transfer (via <a href="https://v4v.app">V4V.app</a>)
		{/snippet}
		{#snippet content()}
			{#if validateRes == undefined}
				{#if typeof res == 'string'}
					<p class="error">Error: {res}</p>
				{:else}
					<p>Scan the QR code below to send {satsToBtc(Number(res.amount))} BTC to V4V</p>
					<QR data={res.qr_data}></QR>
				{/if}
			{:else if validateRes == 'success'}
				<p>Success!</p>
			{:else}
				<p class="error">Error: {validateRes}.</p>
			{/if}
		{/snippet}
	</Dialog>
{/await}

<style>
	p {
		margin-top: var(--text-base);
		margin-bottom: var(--text-base);
	}
	.error {
		color: var(--secondary-bg-mid);
	}
</style>
