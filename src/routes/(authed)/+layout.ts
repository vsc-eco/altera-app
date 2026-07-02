import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { authStore, type Auth, _reownAuthStore } from '$lib/auth/store';
import { redirect } from '@sveltejs/kit';
import { initModal } from '$lib/auth/reown';
import '$lib/auth/hive';

export const ssr = false;
export const prerender = false;

// Wait for auth to settle: resolve on the first 'authenticated' (→ the value)
// or 'none' (→ false). 'pending' keeps waiting — that's what lets the guard sit
// through an in-flight reown reconnect instead of bouncing on the initial none.
// The timeout guards against a reconnect that never settles so we can't hang.
function isAuthenticated(timeoutMs = 10000): Promise<Auth | false> {
	return new Promise<Auth | false>((resolve) => {
		let unsubscribe: () => void = () => {};
		let settled = false;
		const finish = (v: Auth | false) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(v);
			unsubscribe();
		};
		const timer = setTimeout(() => finish(false), timeoutMs);
		const handle = (v: Auth) => {
			if (v.status === 'authenticated' || !browser) {
				finish(v);
			} else if (v.status === 'none') {
				finish(false);
			}
			// 'pending' → keep waiting
		};
		unsubscribe = authStore.subscribe(handle);
	});
}

export async function load({ url }) {
	if (!browser) {
		return { auth: { status: 'pending' } as Auth };
	}
	// Skip auth check on localhost for development
	const isLocalhost =
		window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
	if (isLocalhost) {
		return { auth: { status: 'none' } as Auth };
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

	const authed = await isAuthenticated();
	if (!authed && url.pathname != '/login') {
		localStorage.setItem('redirect_url', url.toString());
		redirect(307, '/login');
	}
	return { auth: authed };
}
