/**
 * fetchPoolRegistry falls back to the last registry the indexer returned, so a
 * swap quote can still find its pool (and its reserves on the node) while the
 * indexer is down; without one the swap has no quote and is not sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasuraQueryMock = vi.fn();
vi.mock('./query', () => ({
	hasuraQuery: (...args: unknown[]) => hasuraQueryMock(...args)
}));
vi.mock('../../client', () => ({ isVscTestnet: () => false }));

const REGISTRY = {
	dex_pool_registry: [
		{ pool_contract: 'vsc1Boani', asset0: 'hbd', asset1: 'hive', fee_bps: 8 },
		{ pool_contract: 'vsc1BVb95', asset0: 'btc', asset1: 'hbd', fee_bps: 8 }
	]
};

async function freshModule() {
	vi.resetModules();
	return import('./poolQueries');
}

beforeEach(() => {
	hasuraQueryMock.mockReset();
	try {
		globalThis.localStorage?.clear?.();
	} catch {
		// no storage in this environment
	}
});

describe('fetchPoolRegistry fallback', () => {
	it('returns the indexer registry when it answers', async () => {
		const { fetchPoolRegistry } = await freshModule();
		hasuraQueryMock.mockResolvedValueOnce(REGISTRY);
		const rows = await fetchPoolRegistry();
		expect(rows.map((r) => r.contractId)).toEqual(['vsc1Boani', 'vsc1BVb95']);
	});

	it('uses the last registry when the indexer then fails', async () => {
		const { fetchPoolRegistry } = await freshModule();
		hasuraQueryMock.mockResolvedValueOnce(REGISTRY);
		await fetchPoolRegistry();
		hasuraQueryMock.mockRejectedValueOnce(new Error('indexer down'));
		const rows = await fetchPoolRegistry();
		expect(rows.map((r) => r.contractId)).toEqual(['vsc1Boani', 'vsc1BVb95']);
	});

	it('uses the last registry when the indexer answers empty', async () => {
		const { fetchPoolRegistry } = await freshModule();
		hasuraQueryMock.mockResolvedValueOnce(REGISTRY);
		await fetchPoolRegistry();
		hasuraQueryMock.mockResolvedValueOnce(null);
		const rows = await fetchPoolRegistry();
		expect(rows).toHaveLength(2);
	});

	it('with nothing cached, an indexer failure still surfaces', async () => {
		const { fetchPoolRegistry } = await freshModule();
		hasuraQueryMock.mockRejectedValueOnce(new Error('indexer down'));
		await expect(fetchPoolRegistry()).rejects.toThrow('indexer down');
	});
});
