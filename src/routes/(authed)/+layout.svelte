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
		background: var(--dash-bg);
		min-height: 100dvh;
		color: var(--dash-text-primary);
		position: relative;
	}
	.app-shell::before {
		content: '';
		position: absolute;
		top: 5%;
		left: 25%;
		width: 90%;
		height: 45%;
		background: radial-gradient(ellipse 70% 50% at 33% 40%, rgba(111, 106, 248, 0.18) 0%, transparent 70%);
		pointer-events: none;
		z-index: 0;
		transform: rotate(24deg);
	}
	.main-area {
		position: relative;
		z-index: 1;
		flex: 1 1 0;
		min-width: 0;
		padding: 0 9.5% 0 9.5%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		overflow: hidden;
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
