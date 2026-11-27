/**
 * The last pool list is kept so the Pools page shows it at once and
 * refreshes behind it (poolsData cachedPools). Only a real list is kept, only
 * for a day, and per network and time range.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../client', () => ({ vscNetworkId: 'vsc-mainnet' }));

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
	removeItem: (k: string) => void store.delete(k)
};

const row = { id: 'p1', contractId: 'vsc1pool', pair: 'USDC:HBD', reserve0Raw: 105560 };

beforeEach(() => {
	store.clear();
	vi.resetModules();
});

describe('cachedPools', () => {
	it('nothing kept: null', async () => {
		const { cachedPools } = await import('./poolsData');
		expect(cachedPools('30d')).toBeNull();
	});

	it('a kept list for this network and range comes back after a reload', async () => {
		store.set('altera.pools.v1.vsc-mainnet.30d', JSON.stringify({ ts: Date.now(), rows: [row] }));
		const { cachedPools } = await import('./poolsData');
		expect(cachedPools('30d')).toEqual([row]);
		expect(cachedPools('7d')).toBeNull();
	});

	it('older than a day, empty, or unreadable: ignored', async () => {
		store.set(
			'altera.pools.v1.vsc-mainnet.30d',
			JSON.stringify({ ts: Date.now() - 25 * 3600 * 1000, rows: [row] })
		);
		store.set('altera.pools.v1.vsc-mainnet.7d', JSON.stringify({ ts: Date.now(), rows: [] }));
		store.set('altera.pools.v1.vsc-mainnet.1d', '{not json');
		const { cachedPools } = await import('./poolsData');
		expect(cachedPools('30d')).toBeNull();
		expect(cachedPools('7d')).toBeNull();
		expect(cachedPools('1d')).toBeNull();
	});
});
