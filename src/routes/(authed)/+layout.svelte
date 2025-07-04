<script lang="ts">
	import { browser } from '$app/environment';
	import Sidebar from '$lib/Sidebar.svelte';
	import Topbar from '$lib/Topbar/Topbar.svelte';
	import { modal } from '$lib/auth/reown';
	import { ensureWalletConnection } from '$lib/auth/reown/reconnect';
	import { getAuth } from '$lib/auth/store';
	import { startAccountPolling, stopAccountPolling } from '$lib/stores/currentBalance';
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { loginRetry } from '$lib/auth/store';
	import { clearAllStores } from '$lib/stores/txStores';
	import { page } from '$app/state';

	let { children } = $props();
	let showSidebar = $state(false);
	
	let auth = $derived(getAuth()());
	let isFullscreen = $derived(page.url.pathname === '/send');
	$effect(() => {
		if (!browser || !auth.value) return;
		startAccountPolling(auth.value.did);
		localStorage.setItem('last_connection', auth.value.provider);
	});
	$effect(() => {
		if ($loginRetry === 'logout') return;
		if ($loginRetry === 'cooldown') {
			if (auth.value) {
				loginRetry.set('retry');
				return;
			}
			clearAllStores();
			goto('/login');
			return;
		}

		if (
			!browser ||
			(auth.value && auth.value?.provider !== 'reown') ||
			localStorage.getItem('last_connection') !== 'reown'
		) {
			return;
		}

		(async () => {
			const success = await ensureWalletConnection();
			if (!success) {
				loginRetry.set('cooldown');
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
	{#if !isFullscreen}
		<Sidebar bind:visible={showSidebar}></Sidebar>
	{/if}
	<div class={["main", {fullscreen: isFullscreen}]}>
		{#if !isFullscreen}
			<Topbar
				onMenuToggle={() => {
					showSidebar = !showSidebar;
				}}
			></Topbar>
		{/if}
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
	.main.fullscreen {
		max-width: none;
	}
</style>
