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
	import { getAccountNameFromAuth } from '$lib/getAccountName';

	let { children } = $props();
	let showSidebar = $state(false);

	let auth = $derived(getAuth()());
	let username = $derived(getAccountNameFromAuth(auth));
	let displayAddress = $derived.by(() => {
		if (!auth.value) return '';
		const addr = auth.value.did || auth.value.address || '';
		if (addr.length > 16) return addr.slice(0, 6) + '...' + addr.slice(-4);
		return addr;
	});

	$effect(() => {
		if (!browser || !auth.value) return;
		startAccountPolling(auth);
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

<div class="bg-mesh"></div>
<div class={['app-shell', { showSidebar }]}>
	<Sidebar bind:visible={showSidebar} />
	<div class="main-area">
		<Topbar onMenuToggle={() => { showSidebar = !showSidebar; }} />
		{#if page.url.pathname === '/'}
			<div class="welcome">
				Welcome, <span class="welcome-address">{displayAddress}</span>
			</div>
		{/if}
		<main>
			{@render children()}
		</main>
	</div>
</div>

<style lang="scss">
	.app-shell {
		display: flex;
		background: transparent;
		min-height: 100dvh;
		color: var(--dash-text-primary);
		position: relative;
		z-index: 1;
	}
	/* Gradient mesh — fixed behind everything for glassmorphism */
	:global(.bg-mesh) {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background:
			radial-gradient(ellipse at 15% 10%, hsla(243, 90%, 65%, 0.45) 0px, transparent 40%),
			radial-gradient(ellipse at 80% 8%, hsla(238, 60%, 55%, 0.3) 0px, transparent 38%),
			radial-gradient(ellipse at 88% 50%, hsla(235, 50%, 50%, 0.2) 0px, transparent 40%),
			radial-gradient(ellipse at 5% 70%, hsla(245, 70%, 55%, 0.25) 0px, transparent 35%),
			radial-gradient(ellipse at 50% 35%, hsla(230, 50%, 40%, 0.2) 0px, transparent 45%),
			radial-gradient(ellipse at 75% 80%, hsla(240, 50%, 45%, 0.15) 0px, transparent 35%);
	}
	.main-area {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		padding: 0 9.5% 0 9.5%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		overflow-x: hidden;
	}
	main {
		position: relative;
		flex-grow: 1;
	}
	.welcome {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--dash-text-secondary);
		margin-bottom: 1.25rem;
	}
	.welcome-address {
		color: var(--dash-text-accent);
	}

	@media screen and (max-width: 620px) {
		.main-area {
			padding: 0 1rem;
			opacity: 1;
			transition: opacity 0.2s;
		}
		.showSidebar .main-area {
			pointer-events: none;
			opacity: 0.2;
		}
	}
</style>
