/**
 * The gated/ungated distinction, pinned.
 *
 * `fetchCustomTokens()` is filtered to tokens the DEX router can route — right
 * for the swap picker, wrong for anything the user simply *sees*. Reading it
 * here reported a 0 balance for every token awaiting register_token /
 * register_pool, which is how mainnet's LASSECASH showed as 0 in Add Liquidity
 * while the token panel showed a real holding.
 *
 * Balances are display data, so they must come from `fetchPoolTokens()`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const hasuraQueryMock = vi.fn();
const fetchPoolTokensMock = vi.fn();
const fetchCustomTokensMock = vi.fn();

vi.mock('$lib/indexer/query', () => ({
	hasuraQuery: (...args: unknown[]) => hasuraQueryMock(...args)
}));
vi.mock('./customTokens', () => ({
	fetchPoolTokens: (...args: unknown[]) => fetchPoolTokensMock(...args),
	fetchCustomTokens: (...args: unknown[]) => fetchCustomTokensMock(...args)
}));

const { customTokenBalances, refreshCustomTokenBalances } = await import('./customTokenBalances');

const LASSE_CONTRACT = 'vsc1BUDsVccMPGycTmpc98WsQYSKyTBsZqFq4h';
const DID = 'hive:tibfox';

/** A real, held token whose pool the router does NOT know about. */
const UNREGISTERED_TOKEN = {
	symbol: 'lassecash',
	label: 'LASSECASH',
	name: 'LasseCash',
	decimals: 8,
	contractId: LASSE_CONTRACT,
	poolContractId: 'vsc1BrBFAwZ3Mr8L4ijRqT9RPEPvhK9FWDaYSr',
	routerRegistered: false
};

beforeEach(() => {
	fetchPoolTokensMock.mockResolvedValue([UNREGISTERED_TOKEN]);
	// The gated list is empty — LASSECASH isn't routable.
	fetchCustomTokensMock.mockResolvedValue([]);
	hasuraQueryMock.mockResolvedValue({
		magi_token_balances: [{ contract_id: LASSE_CONTRACT, balance: 381632615 }]
	});
});
afterEach(() => {
	hasuraQueryMock.mockReset();
	fetchPoolTokensMock.mockReset();
	fetchCustomTokensMock.mockReset();
});

describe('refreshCustomTokenBalances', () => {
	it('reports the balance of a token the router cannot route', async () => {
		await refreshCustomTokenBalances(DID);
		expect(get(customTokenBalances).bal.lassecash).toBe(381632615);
	});

	it('sources tokens from the ungated list, never the swap-gated one', async () => {
		await refreshCustomTokenBalances(DID);
		expect(fetchPoolTokensMock).toHaveBeenCalled();
		expect(fetchCustomTokensMock).not.toHaveBeenCalled();
	});

	it('records 0 for a held-nothing token rather than omitting it', async () => {
		hasuraQueryMock.mockResolvedValue({ magi_token_balances: [] });
		await refreshCustomTokenBalances(DID);
		expect(get(customTokenBalances).bal.lassecash).toBe(0);
	});

	it('queries by the account DID and the tokens’ contract ids', async () => {
		await refreshCustomTokenBalances(DID);
		expect(hasuraQueryMock.mock.calls[0][1]).toEqual({
			account: DID,
			contracts: [LASSE_CONTRACT]
		});
	});

	it('clears balances when signed out', async () => {
		await refreshCustomTokenBalances('');
		expect(get(customTokenBalances)).toEqual({ bal: {}, loading: false, did: null });
	});

	it('returns empty rather than throwing when the indexer fails', async () => {
		hasuraQueryMock.mockRejectedValue(new Error('indexer down'));
		await refreshCustomTokenBalances(DID);
		expect(get(customTokenBalances).bal).toEqual({});
		expect(get(customTokenBalances).loading).toBe(false);
	});
});
