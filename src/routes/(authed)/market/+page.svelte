<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { KeyTypes } from '@aioha/aioha';
	import { getAuth } from '$lib/auth/store';
	import { getMagiIndexerBaseUrl, vscNetworkId } from '../../../client';
	import '@vsc.eco/market-widget/styles.css';

	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	let aioha = $derived(auth.value?.aioha);

	// The deployed magi-market contract, per network. Mainnet is the contract
	// milo deployed 2026-07-22; testnet is the long-standing instance. The
	// SDK's own MAINNET_CONFIG still ships the testnet id as a placeholder, so
	// we must set marketContractId explicitly — this is what "connects the page
	// to the new contract".
	const isTestnet = vscNetworkId === 'vsc-testnet';
	const marketContractId = isTestnet
		? 'vsc1BnMAaeUzhzVcfKMDG5vphthhymk6irjLNq'
		: 'vsc1BdZFXb8HdLptKUamNG4nL74hSb6UUBEiQA';

	// Read side (listings/auctions/mint-spots) is served by an indexer that
	// projects the magi_market_* fold views. The okinoko indexer is the one we
	// keep configured for this contract, so it is primary; the app's own
	// configured Magi indexer is the failover. Ordering matters: failover fires
	// only on error, NOT on an empty result — so the indexer that actually
	// tracks this contract must come first, or a stale/generic indexer would
	// return "no listings" without ever failing over.
	const okinokoHasura = isTestnet
		? 'https://api-testnet.okinoko.io/hasura/v1/graphql'
		: 'https://api.okinoko.io/hasura/v1/graphql';
	const indexerHasuraUrls = [okinokoHasura, `${getMagiIndexerBaseUrl()}/v1/graphql`];

	// VSC node GraphQL — used by the SDK for getStateByKeys / findContractOutput
	// (write verification). Known-good mainnet/testnet node endpoints.
	const gqlUrls = isTestnet
		? ['https://magi-test.techcoderx.com/api/v1/graphql']
		: [
				'https://api.vsc.eco/api/v1/graphql',
				'https://vsc.techcoderx.com/api/v1/graphql',
				'https://api.okinoko.io/api/v1/graphql'
			];

	const marketConfig = {
		network: (isTestnet ? 'vsc-testnet' : 'vsc-mainnet') as 'vsc-testnet' | 'vsc-mainnet',
		marketContractId,
		indexerHasuraUrls,
		gqlUrls
	};

	let host: HTMLDivElement | undefined = $state();
	let ready = $state(false);
	// React root + MagiMarketPanel are loaded dynamically so the SSR bundle
	// stays react-free and the import only runs once we're in the browser.
	type ReactRoot = { render: (node: unknown) => void; unmount: () => void };
	let root: ReactRoot | undefined;
	let createElement: ((type: unknown, props: Record<string, unknown>) => unknown) | undefined;
	let MagiMarketPanel: unknown;

	onMount(async () => {
		const [react, reactDom, widget] = await Promise.all([
			import('react'),
			import('react-dom/client'),
			import('@vsc.eco/market-widget')
		]);
		if (!host) return;
		createElement = react.createElement as unknown as typeof createElement;
		MagiMarketPanel = widget.MagiMarketPanel;
		root = reactDom.createRoot(host) as unknown as ReactRoot;
		ready = true;
	});

	onDestroy(() => {
		root?.unmount();
		root = undefined;
	});

	$effect(() => {
		if (!ready || !root || !createElement || !MagiMarketPanel || !username) return;
		root.render(
			createElement(MagiMarketPanel, {
				aioha,
				keyType: KeyTypes.Active,
				username,
				config: marketConfig,
				enableRefresh: true
			})
		);
	});
</script>

<svelte:head>
	<title>NFT Market</title>
</svelte:head>

<h1>NFT Market</h1>

{#if !username}
	<p class="error">
		The NFT marketplace requires a Hive account. Please
		<a href="/logout">logout</a> and sign in with Hive.
	</p>
{:else if !ready}
	<p class="muted">Loading widget…</p>
{/if}

<div bind:this={host} class="widget-host"></div>

<style>
	:global(h1) {
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
	.error {
		color: var(--dash-text-secondary, #b66);
	}
	.muted {
		color: var(--dash-text-secondary);
	}
	.widget-host {
		width: 100%;
	}
	/* Override the widget's internal max-width cap so it fills the main area. */
	.widget-host :global(.magi-token),
	.widget-host :global(.magi-market) {
		max-width: none;
		width: 100%;
	}
</style>
