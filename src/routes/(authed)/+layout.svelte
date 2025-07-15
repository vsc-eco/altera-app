<script lang="ts">
	import { browser } from '$app/environment';
	let { children } = $props();
	import Sidebar from '$lib/Sidebar.svelte';
	import Topbar from '$lib/Topbar/Topbar.svelte';
	import { modal } from '$lib/auth/reown';
	import { ensureWalletConnection } from '$lib/auth/reown/reconnect';
	let showSidebar = $state(false);
	import { getAuth } from '$lib/auth/store';
	import { startAccountPolling, stopAccountPolling } from '$lib/stores/currentBalance';
	import { onDestroy } from 'svelte';
	import { clearAllStores } from './transactions/txStores';
	import { goto } from '$app/navigation';

	let retried = false;

	let auth = $derived(getAuth()());
	$effect(() => {
		if (!browser || !auth.value) return;
		startAccountPolling(auth.value.did);
	});
	$effect(() => {
		if (retried === true) {
			console.log("here");
			if (auth.value) {
				retried = false;
				return;
			}
			clearAllStores();
			goto('/login');
			return;
		}
		if (!browser || (auth.value && auth.value?.provider !== 'reown')) return;
		(async () => {
			const success = await ensureWalletConnection();
			if (!success) {
				retried = true;
				modal.open();
			}
		})();
	});
	onDestroy(() => {
		if (browser) {
			stopAccountPolling();
		}
	});
</script>

<div class={['flex', { showSidebar }]}>
	<Sidebar bind:visible={showSidebar}></Sidebar>
	<div class="main">
		<Topbar
			onMenuToggle={() => {
				showSidebar = !showSidebar;
			}}
		></Topbar>
		<main>
			{@render children()}
		</main>
	</div>
</div>

<style>
	.flex {
		display: flex;
	}
	@media screen and (max-width: 620px) {
		.main {
			opacity: 1;
			transition: opacity 0.2s;
		}
		.showSidebar .main {
			pointer-events: none;
			opacity: 0.2;
		}
	}
	.main {
		padding: 0rem 0.5rem;
		flex: 1;
		max-width: 64rem;
		margin-left: auto;
		margin-right: auto;
		flex-shrink: 1;
		width: 100%;
		box-sizing: border-box;
		flex-basis: 0;
		overflow: hidden;
	}
</style>
