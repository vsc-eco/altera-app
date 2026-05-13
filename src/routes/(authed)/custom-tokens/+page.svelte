<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { KeyTypes } from '@aioha/aioha';
	import { getAuth } from '$lib/auth/store';
	import '@vsc.eco/token-widget/styles.css';

	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	let aioha = $derived(auth.value?.aioha);

	let host: HTMLDivElement | undefined = $state();
	let ready = $state(false);
	// React root + MagiAssets are loaded dynamically so the SSR bundle stays
	// react-free and the import only runs once we're in the browser.
	type ReactRoot = { render: (node: unknown) => void; unmount: () => void };
	let root: ReactRoot | undefined;
	let createElement: ((type: unknown, props: Record<string, unknown>) => unknown) | undefined;
	let MagiAssets: unknown;

	onMount(async () => {
		const [react, reactDom, widget] = await Promise.all([
			import('react'),
			import('react-dom/client'),
			import('@vsc.eco/token-widget')
		]);
		if (!host) return;
		createElement = react.createElement as unknown as typeof createElement;
		MagiAssets = widget.MagiAssets;
		root = reactDom.createRoot(host) as unknown as ReactRoot;
		ready = true;
	});

	onDestroy(() => {
		root?.unmount();
		root = undefined;
	});

	$effect(() => {
		if (!ready || !root || !createElement || !MagiAssets || !username) return;
		root.render(
			createElement(MagiAssets, {
				aioha,
				keyType: KeyTypes.Active,
				username,
				enableDeploy: true,
				enableRefresh: true,
				enableUserSearch: true
			})
		);
	});
</script>

<svelte:head>
	<title>Magi Tokens / NFTs</title>
</svelte:head>

<h1>Magi Tokens / NFTs</h1>

{#if !username}
	<p class="error">
		Magi token + NFT management requires a Hive account. Please
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
	/* Override the widget's internal 720px cap so it fills the main area. */
	.widget-host :global(.magi-token) {
		max-width: none;
		width: 100%;
	}
</style>
