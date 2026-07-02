import { browser } from '$app/environment';
import type { Readable } from 'svelte/store';
import type { Auth } from './store';

/**
 * Resolve once the auth store settles: the `Auth` value on `authenticated`, or
 * `false` on `none`. `pending` keeps waiting — that's what lets the (authed)
 * route guard sit through an in-flight reown reconnect instead of bouncing on
 * the initial `none`. Times out to `false` so a reconnect that never settles
 * can't hang the guard.
 *
 * Extracted from the route guard so it's unit-testable in isolation.
 */
export function waitForAuth(store: Readable<Auth>, timeoutMs = 10000): Promise<Auth | false> {
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
		unsubscribe = store.subscribe(handle);
		// Svelte calls `handle` synchronously during subscribe with the current
		// value. If that already resolved, `unsubscribe` above was still the no-op
		// placeholder — clean up the now-assigned real subscription here so it
		// doesn't leak.
		if (settled) unsubscribe();
	});
}
