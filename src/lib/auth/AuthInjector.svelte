<script lang="ts">
	import { setContext, untrack, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { authStore, type Auth } from './store';

	let authState: Auth = $state({ status: 'pending' });
	// to enable the getAuth function call
	setContext('auth', () => authState);
	$effect(() => {
		return authStore.subscribe((newAuth) => {
			authState = newAuth;
		});
	});

	// Restore persisted Reown sessions (BTC via Leather/Xverse, EVM via
	// MetaMask, etc.) on reload.
	//
	// Strategy: when we have a cached session from a previous
	// successful connection, restore auth from localStorage and
	// DON'T init the modal. AppKit's `createAppKit` runs
	// `syncConnections` during init which drives each adapter's
	// `connect()` — for Leather that pops the "Connect app"
	// permission prompt on every F5 even when the wallet already
	// has an active session. Skipping init entirely keeps the page
	// load silent; the modal only gets created lazily on the first
	// action that actually needs it (Connect click, deposit tx,
	// openSettings), at which point a prompt is expected.
	//
	// When no cache is present we fall back to the original lazy
	// init so `/login` still works normally.
	onMount(() => {
		if (!browser) return;
		queueMicrotask(async () => {
			try {
				const { loadCachedSession, initModal, reownLogout, openModal } = await import(
					'./reown'
				);
				const cached = loadCachedSession();
				if (cached) {
					const { _reownAuthStore } = await import('./store');
					_reownAuthStore.set({
						status: 'authenticated',
						value: {
							address: cached.address,
							did: cached.did,
							provider: 'reown',
							logout: reownLogout,
							openSettings: () => openModal()
						}
					});
					return;
				}
				initModal();
			} catch (err) {
				console.warn('Reown session restore on mount failed', err);
			}
		});
	});
	// to make sure that if a user is unauthed that they won't get a flash
	// on load
	let initialPending = $state(true);
	$effect(() => {
		initialPending = initialPending === false ? false : authState.status === 'pending';
	});
	let { children } = $props();
</script>

<div class={{ pending: initialPending }}>
	{@render children()}
</div>

<style>
	div {
		opacity: 1;
		transition: opacity 0.5s;
	}
	div.pending {
		opacity: 1;
	}
</style>
