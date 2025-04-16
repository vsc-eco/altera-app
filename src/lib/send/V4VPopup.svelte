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
		onsuccess,
		toUsername
	}: {
		from: CoinOnNetwork;
		to: CoinOnNetwork;
		toAmount: string;
		toUsername: string;
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
			auth,
			toUsername
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
	$effect(() => {
		if (!dialogOpen) {
			if (onerror && validateRes != 'success')
				onerror('Error: Lightning dialog closed before invoice was scanned and processed.');
			lightningAbort.abort('Lightning dialog closed.');
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
		return () => lightningAbort.abort;
	});
	let toggle: (open?: boolean) => void = $state(() => {});
</script>

{#await invoiceReq then res}
	<Dialog bind:toggle bind:open={dialogOpen} defaultOpen={true}>
		{#snippet title()}
			Lightning Transfer (via <a href="https://v4v.app" target="_blank" rel="noreferrer">V4V.app</a
			>)
		{/snippet}
		{#snippet content()}
			{#if validateRes == undefined}
				{#if typeof res == 'string'}
					<p class="error">Error: {res}</p>
				{:else}
					<p>
						Scan the QR code below to send {new Intl.NumberFormat('en-US', {
							maximumFractionDigits: 10
						}).format(satsToBtc(Number(res.amount)))} BTC to V4V
					</p>
					<QR data={res.qr_data}></QR>
				{/if}
			{:else if validateRes == 'success'}
				<p>The transfer of {toAmount} {to.coin} was successful!</p>
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
</style>
