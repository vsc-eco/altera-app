import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { authStore, type Auth, _reownAuthStore } from '$lib/auth/store';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { initModal } from '$lib/auth/reown';
import { waitForAuth } from '$lib/auth/waitForAuth';
import '$lib/auth/hive';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ url }) => {
	if (!browser) {
		return { auth: { status: 'pending' } as Auth };
	}

	// A hard reload wipes the in-memory reown (BTC/EVM) session, and initModal()
	// is otherwise only created on demand — so the guard would see reown 'none'
	// and bounce the user to /login before AppKit could reconnect. AppKit CAN
	// silently reconnect a cached session (verified: initModal() → subscribeAccount
	// fires connecting → connected, no wallet prompt), but it's async. So when the
	// user last connected a reown wallet, mark reown 'pending' and start the
	// reconnect BEFORE the auth check — the guard then waits for it to resolve
	// (authenticated, or a settled none) instead of bouncing on the initial none.
	// Guard on reown === 'none' so this only fires when there's no in-memory
	// session (a hard reload) — not on client-side navigation where reown is
	// already 'authenticated' (setting it 'pending' there would strand it, since
	// initModal() no-ops when the modal already exists and won't re-fire).
	if (
		localStorage.getItem('last_connection') === 'reown' &&
		get(_reownAuthStore).status === 'none'
	) {
		_reownAuthStore.set({ status: 'pending' });
		initModal();
	}

	const authed = await waitForAuth(authStore);
	if (!authed && url.pathname !== '/login') {
		localStorage.setItem('redirect_url', url.toString());
		throw redirect(307, '/login');
	}
	return { auth: authed };
};
