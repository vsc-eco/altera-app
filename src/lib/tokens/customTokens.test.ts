/**
 * Tests for custom-token discovery.
 *
 * Two things this module exists to get right, both pinned here:
 *
 *   1. **The contract comes from the POOL, not the token registry.** Mainnet
 *      has two contracts claiming the symbol `LASSECASH`; only one is bound to
 *      the live pool, and it's the one `approve` must target. Matching on
 *      symbol would pick whichever row came back first — a swap that then
 *      approves the wrong contract and aborts on the router's `transferFrom`.
 *   2. **Only pool-backed tokens are returned.** The registry lists tokens with
 *      no pool (DIY, FERNLET); offering those in the picker gives the user a
 *      dead end, since there's nothing to route through.
 *
 * Network boundaries (`hasuraQuery`, `queryOnce`, the pool registry) are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hasuraQueryMock = vi.fn();
const fetchPoolRegistryMock = vi.fn();
const queryOnceMock = vi.fn();

vi.mock('$lib/indexer/query', () => ({
	hasuraQuery: (...args: unknown[]) => hasuraQueryMock(...args)
}));
vi.mock('$lib/indexer/poolQueries', () => ({
	fetchPoolRegistry: (...args: unknown[]) => fetchPoolRegistryMock(...args)
}));
vi.mock('$lib/queryOnce', () => ({
	queryOnce: (...args: unknown[]) => queryOnceMock(...args)
}));
vi.mock('$houdini', () => ({
	GetStateByKeysStore: class {}
}));
vi.mock('../../client', () => ({
	DEX_ROUTER_CONTRACT_ID: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45'
}));

const { fetchCustomTokens, customTokenCoin } = await import('./customTokens');

// Live mainnet identifiers, 2026-09-09.
const LASSE_POOL = 'vsc1BrBFAwZ3Mr8L4ijRqT9RPEPvhK9FWDaYSr';
/** The contract the pool is actually bound to. */
const LASSE_BOUND = 'vsc1BUDsVccMPGycTmpc98WsQYSKyTBsZqFq4h';
/** A second contract with the SAME symbol — the decoy. */
const LASSE_DECOY = 'vsc1Bq7L9VhLbN6eJdCD8My9jmjAdpxADJLEGR';
const DIY_CONTRACT = 'vsc1BZ2MxAyWQH6ookn11xzVzbugBGjbkTUYgT';
const ROUTER = 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45';

const NATIVE_POOLS = [
	{ contractId: 'vsc1Boani', symbols: ['HBD', 'HIVE'] as [string, string], feeBps: 8 },
	{ contractId: 'vsc1BVb95', symbols: ['BTC', 'HBD'] as [string, string], feeBps: 8 }
];
const CUSTOM_POOL = {
	contractId: LASSE_POOL,
	symbols: ['HBD', 'LASSECASH'] as [string, string],
	feeBps: 8
};

/** Overview rows: the decoy is listed FIRST so a symbol-match would pick it. */
const OVERVIEW = [
	{ contract_id: DIY_CONTRACT, symbol: 'DIY', name: 'DIY token', decimals: 0, paused: false },
	{
		contract_id: LASSE_DECOY,
		symbol: 'LASSECASH',
		name: 'LasseCash',
		decimals: 8,
		paused: false
	},
	{
		contract_id: LASSE_BOUND,
		symbol: 'LASSECASH',
		name: 'LasseCash',
		decimals: 8,
		paused: false
	}
];

/** The real pool's binding: HBD on side 0 (no mapping), the token on side 1,
 *  pointing back at the router the app uses. */
const LASSE_BINDING = {
	a0n: 'hbd',
	a0m: '',
	a1n: 'lassecash',
	a1m: LASSE_BOUND,
	rtr: ROUTER
};

/** A router with `register_token` done for BOTH sides of the pair and
 *  `register_pool` done. `asset-hbd` is included because the registration
 *  check verifies every asset in the pair, not just the custom one. */
const ROUTER_REGISTERED = {
	'asset-hbd': '{"chain":"HIVE","decimals":3}',
	'asset-lassecash': '{"mapping_contract":"' + LASSE_BOUND + '","chain":"MAGI","decimals":8}',
	'pool-hbd-lassecash': LASSE_POOL
};

/**
 * Route state reads by contract id: pool reads get the binding, the single
 * batched router read gets the registration map.
 */
function mockState(poolState: Record<string, string>, routerState: Record<string, string>) {
	queryOnceMock.mockImplementation((_store: unknown, opts: any) =>
		Promise.resolve({
			data: {
				getStateByKeys:
					opts?.variables?.contractId === ROUTER ? routerState : poolState
			}
		})
	);
}

beforeEach(() => {
	hasuraQueryMock.mockResolvedValue({ magi_token_overview: OVERVIEW });
	fetchPoolRegistryMock.mockResolvedValue([...NATIVE_POOLS, CUSTOM_POOL]);
	mockState(LASSE_BINDING, ROUTER_REGISTERED);
});
afterEach(() => {
	hasuraQueryMock.mockReset();
	fetchPoolRegistryMock.mockReset();
	queryOnceMock.mockReset();
});

describe('fetchCustomTokens', () => {
	it('returns only the pool-backed token, not every registered one', async () => {
		const tokens = await fetchCustomTokens();
		expect(tokens).toHaveLength(1);
		expect(tokens[0].symbol).toBe('lassecash');
		// DIY is registered but has no pool.
		expect(tokens.some((t) => t.symbol === 'diy')).toBe(false);
	});

	it('binds the contract the POOL names, not the first symbol match', async () => {
		const [token] = await fetchCustomTokens();
		expect(token.contractId).toBe(LASSE_BOUND);
		expect(token.contractId).not.toBe(LASSE_DECOY);
		expect(token.poolContractId).toBe(LASSE_POOL);
	});

	it('carries the metadata the swap flow needs', async () => {
		const [token] = await fetchCustomTokens();
		expect(token.label).toBe('LASSECASH');
		expect(token.name).toBe('LasseCash');
		expect(token.decimals).toBe(8);
	});

	it('only reads state for pools that have a custom side', async () => {
		await fetchCustomTokens();
		// One custom pool → one pool read (the two native pools are skipped),
		// plus ONE batched router read for every candidate.
		expect(queryOnceMock).toHaveBeenCalledTimes(2);
		expect(queryOnceMock.mock.calls[0][1].variables.contractId).toBe(LASSE_POOL);
		expect(queryOnceMock.mock.calls[1][1].variables.contractId).toBe(ROUTER);
	});

	it('skips a paused token — transfers on it would abort', async () => {
		hasuraQueryMock.mockResolvedValue({
			magi_token_overview: OVERVIEW.map((r) =>
				r.contract_id === LASSE_BOUND ? { ...r, paused: true } : r
			)
		});
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('skips a token the indexer has no metadata for', async () => {
		hasuraQueryMock.mockResolvedValue({
			magi_token_overview: OVERVIEW.filter((r) => r.contract_id !== LASSE_BOUND)
		});
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('skips a pool whose binding is unreadable', async () => {
		mockState({}, ROUTER_REGISTERED);
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('returns [] when there are no custom pools at all', async () => {
		fetchPoolRegistryMock.mockResolvedValue(NATIVE_POOLS);
		expect(await fetchCustomTokens()).toEqual([]);
		expect(queryOnceMock).not.toHaveBeenCalled();
	});

	it('skips a token the router has no asset registration for', async () => {
		// register_pool done, register_token forgotten.
		mockState(LASSE_BINDING, { 'pool-hbd-lassecash': LASSE_POOL });
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('skips a token whose pool the router does not know', async () => {
		// This is mainnet's real state as of 2026-09-09: the HBD:LASSECASH pool
		// is deployed and seeded, but neither register_token nor register_pool
		// was ever run, so every swap through it would abort.
		mockState(LASSE_BINDING, {});
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('skips a pool the router routes elsewhere for the same pair', async () => {
		mockState(LASSE_BINDING, {
			...ROUTER_REGISTERED,
			'pool-hbd-lassecash': 'vsc1BsomeOtherPoolContractIdEntirely'
		});
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('skips a pool bound to a different router', async () => {
		mockState({ ...LASSE_BINDING, rtr: 'vsc1BsupersededRouterXXXXXXXXXXXXXXXXX' }, ROUTER_REGISTERED);
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('offers nothing when router registration cannot be read', async () => {
		queryOnceMock.mockImplementation((_store: unknown, opts: any) =>
			opts?.variables?.contractId === ROUTER
				? Promise.reject(new Error('node down'))
				: Promise.resolve({ data: { getStateByKeys: LASSE_BINDING } })
		);
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('returns [] rather than throwing when the registry query fails', async () => {
		fetchPoolRegistryMock.mockRejectedValue(new Error('indexer down'));
		expect(await fetchCustomTokens()).toEqual([]);
	});

	it('shares one in-flight request between concurrent callers', async () => {
		const [a, b] = await Promise.all([fetchCustomTokens(), fetchCustomTokens()]);
		expect(a).toEqual(b);
		expect(fetchPoolRegistryMock).toHaveBeenCalledTimes(1);
	});
});

describe('customTokenCoin', () => {
	it('keys the coin on the lowercase symbol the router routes on', async () => {
		const [token] = await fetchCustomTokens();
		const coin = customTokenCoin(token);
		expect(coin.value).toBe('lassecash');
		expect(coin.label).toBe('LASSECASH');
		expect(coin.unit).toBe('LASSECASH');
		expect(coin.decimalPlaces).toBe(8);
	});
});
