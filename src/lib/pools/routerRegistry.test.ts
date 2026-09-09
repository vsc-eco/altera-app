/**
 * Tests for the router-registration check that gates swaps and Add liquidity.
 *
 * The distinction this encodes: a pool contract works when called DIRECTLY —
 * mainnet's HBD:LASSECASH pool was seeded that way and holds real funds — but
 * everything Altera does goes through the DEX router, which can only reach
 * pools registered in its own state. So "the pool exists and has liquidity" is
 * no evidence at all that we can deposit into it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryOnceMock = vi.fn();
vi.mock('$lib/queryOnce', () => ({
	queryOnce: (...args: unknown[]) => queryOnceMock(...args)
}));
vi.mock('$houdini', () => ({ GetStateByKeysStore: class {} }));
vi.mock('../../client', () => ({
	DEX_ROUTER_CONTRACT_ID: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45'
}));

const { fetchRouterRegistrations, registrationHint } = await import('./routerRegistry');

const ROUTER = 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45';
const HIVE_POOL = 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp';
const LASSE_POOL = 'vsc1BrBFAwZ3Mr8L4ijRqT9RPEPvhK9FWDaYSr';

const HIVE_QUERY = { contractId: HIVE_POOL, symbols: ['hbd', 'hive'] as [string, string] };
const LASSE_QUERY = { contractId: LASSE_POOL, symbols: ['hbd', 'lassecash'] as [string, string] };

/** Mainnet's router state, 2026-09-09: natives registered, LASSECASH not. */
const MAINNET_STATE = {
	'asset-hbd': '{"chain":"HIVE","decimals":3}',
	'asset-hive': '{"chain":"HIVE","decimals":3}',
	'asset-lassecash': null,
	'pool-hbd-hive': HIVE_POOL,
	'pool-hbd-lassecash': null
};

function mockRouter(state: Record<string, string | null>) {
	queryOnceMock.mockResolvedValue({ data: { getStateByKeys: state } });
}

beforeEach(() => mockRouter(MAINNET_STATE));
afterEach(() => queryOnceMock.mockReset());

describe('fetchRouterRegistrations', () => {
	it('reproduces mainnet: the native pool routes, the custom one does not', async () => {
		const regs = await fetchRouterRegistrations([HIVE_QUERY, LASSE_QUERY]);
		expect(regs.get(HIVE_POOL)?.registered).toBe(true);
		expect(regs.get(LASSE_POOL)?.registered).toBe(false);
		expect(regs.get(LASSE_POOL)?.missing).toBe('register_token');
	});

	it('reads every pool in one batched call', async () => {
		await fetchRouterRegistrations([HIVE_QUERY, LASSE_QUERY]);
		expect(queryOnceMock).toHaveBeenCalledTimes(1);
		const vars = queryOnceMock.mock.calls[0][1].variables;
		expect(vars.contractId).toBe(ROUTER);
		// Deduplicated: `asset-hbd` is shared by both pairs.
		expect(vars.keys).toEqual([
			'asset-hbd',
			'asset-hive',
			'pool-hbd-hive',
			'asset-lassecash',
			'pool-hbd-lassecash'
		]);
	});

	it('reports register_pool when the assets are known but the pool is not', async () => {
		mockRouter({ ...MAINNET_STATE, 'asset-lassecash': '{"chain":"MAGI","decimals":8}' });
		const regs = await fetchRouterRegistrations([LASSE_QUERY]);
		expect(regs.get(LASSE_POOL)).toEqual({ registered: false, missing: 'register_pool' });
	});

	it('rejects a pool the router routes elsewhere for the same pair', async () => {
		mockRouter({
			...MAINNET_STATE,
			'asset-lassecash': '{"chain":"MAGI","decimals":8}',
			'pool-hbd-lassecash': 'vsc1BdifferentPoolEntirely'
		});
		const regs = await fetchRouterRegistrations([LASSE_QUERY]);
		expect(regs.get(LASSE_POOL)).toEqual({ registered: false, missing: 'pool_mismatch' });
	});

	it('treats every pool as unroutable when the read fails', async () => {
		queryOnceMock.mockRejectedValue(new Error('node down'));
		const regs = await fetchRouterRegistrations([HIVE_QUERY, LASSE_QUERY]);
		expect(regs.get(HIVE_POOL)?.registered).toBe(false);
		expect(regs.get(LASSE_POOL)?.registered).toBe(false);
	});

	it('makes no call for an empty list', async () => {
		expect((await fetchRouterRegistrations([])).size).toBe(0);
		expect(queryOnceMock).not.toHaveBeenCalled();
	});
});

describe('registrationHint', () => {
	it('is empty for a routable pool', () => {
		expect(registrationHint({ registered: true }, 'HBD:HIVE')).toBe('');
		expect(registrationHint(undefined, 'HBD:HIVE')).toBe('');
	});

	it('names the pair and the missing step', () => {
		const hint = registrationHint({ registered: false, missing: 'register_token' }, 'HBD:LASSECASH');
		expect(hint).toContain('HBD:LASSECASH');
		expect(hint).toContain('register_token');
	});

	it('explains a mismatch differently from a plain omission', () => {
		const hint = registrationHint({ registered: false, missing: 'pool_mismatch' }, 'HBD:LASSECASH');
		expect(hint).toContain('not the pool the DEX routes');
	});
});
