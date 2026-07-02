import { describe, it, expect, vi } from 'vitest';
import { writable, type Readable, type Subscriber } from 'svelte/store';
import type { Auth } from './store';

// waitForAuth's `!browser` branch would short-circuit (resolve on the first
// emission regardless of status) under the node/server env where browser=false.
// Pin browser=true so the test exercises the real client behaviour.
vi.mock('$app/environment', () => ({ browser: true }));

import { waitForAuth } from './waitForAuth';

const authed: Auth = {
	status: 'authenticated',
	value: {
		address: '0x1',
		did: 'did:pkh:eip155:1:0x1',
		provider: 'reown',
		logout: async () => {},
		openSettings: () => {}
	}
};
const none: Auth = { status: 'none' };
const pending: Auth = { status: 'pending' };

/** A store that tracks its live subscriber count, so we can prove waitForAuth
 *  always unsubscribes (no leak) — including on a synchronous resolve. */
function trackedStore(initial: Auth) {
	const inner = writable<Auth>(initial);
	let liveSubs = 0;
	const store: Readable<Auth> & { set: (v: Auth) => void; liveSubs: () => number } = {
		set: inner.set,
		liveSubs: () => liveSubs,
		subscribe(run: Subscriber<Auth>) {
			liveSubs++;
			const unsub = inner.subscribe(run);
			return () => {
				liveSubs--;
				unsub();
			};
		}
	};
	return store;
}

describe('waitForAuth', () => {
	it('resolves with the value when already authenticated (synchronous)', async () => {
		const store = trackedStore(authed);
		const result = await waitForAuth(store);
		expect(result).not.toBe(false);
		expect((result as Auth).status).toBe('authenticated');
		expect(store.liveSubs()).toBe(0); // no leaked subscription
	});

	it('resolves false when already none (synchronous) — and does NOT leak', async () => {
		// This is the regression test for the sync-subscribe leak: without the
		// `if (settled) unsubscribe()` guard, liveSubs would stay at 1.
		const store = trackedStore(none);
		const result = await waitForAuth(store);
		expect(result).toBe(false);
		expect(store.liveSubs()).toBe(0);
	});

	it('waits through pending, then resolves on authenticated', async () => {
		const store = trackedStore(pending);
		const p = waitForAuth(store);
		store.set(authed);
		const result = await p;
		expect((result as Auth).status).toBe('authenticated');
		expect(store.liveSubs()).toBe(0);
	});

	it('waits through pending, then resolves false on none', async () => {
		const store = trackedStore(pending);
		const p = waitForAuth(store);
		store.set(none);
		const result = await p;
		expect(result).toBe(false);
		expect(store.liveSubs()).toBe(0);
	});

	it('times out to false when it never settles', async () => {
		vi.useFakeTimers();
		try {
			const store = trackedStore(pending);
			const p = waitForAuth(store, 5000);
			await vi.advanceTimersByTimeAsync(5000);
			const result = await p;
			expect(result).toBe(false);
			expect(store.liveSubs()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
});
