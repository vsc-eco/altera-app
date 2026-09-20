/**
 * Deriving a custom token's price from its DEX pool.
 *
 * Every pool pairs its token against HBD, so the reserve ratio is the rate.
 * Two things to get right: the token's side of the pair depends on its symbol
 * (pools normalise alphabetically), and each side scales by its own decimals —
 * HBD is 3 dp while a token can be anything.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPoolTokensMock = vi.fn();
const fetchTypedPoolDepthsMock = vi.fn();

vi.mock('./customTokens', () => ({
	fetchPoolTokens: (...a: unknown[]) => fetchPoolTokensMock(...a)
}));
vi.mock('$lib/pools/swapCalc', () => ({
	fetchTypedPoolDepths: (...a: unknown[]) => fetchTypedPoolDepthsMock(...a),
	DEX_BASE_ASSET: 'hbd'
}));

const { getCustomTokenHbdRates, clearCustomTokenRateCache } = await import('./customTokenRates');

const LASSE = {
	symbol: 'lassecash',
	label: 'LASSECASH',
	name: 'LasseCash',
	decimals: 8,
	contractId: 'vsc1BUDsVccMPGycTmpc98WsQYSKyTBsZqFq4h',
	poolContractId: 'vsc1BrBFAwZ3Mr8L4ijRqT9RPEPvhK9FWDaYSr',
	routerRegistered: true
};

/** The live mainnet pool: 9.905 HBD against 27,000 LASSECASH. */
const LIVE_POOL = {
	contractId: LASSE.poolContractId,
	asset0: 'hbd',
	asset1: 'lassecash',
	reserve0: 9905n, // 9.905 HBD at 3 dp
	reserve1: 2_700_000_000_000n // 27,000 LASSECASH at 8 dp
};

beforeEach(() => {
	clearCustomTokenRateCache();
	fetchPoolTokensMock.mockResolvedValue([LASSE]);
	fetchTypedPoolDepthsMock.mockResolvedValue(LIVE_POOL);
});
afterEach(() => {
	clearCustomTokenRateCache();
	fetchPoolTokensMock.mockReset();
	fetchTypedPoolDepthsMock.mockReset();
});

describe('getCustomTokenHbdRates', () => {
	it('derives HBD per token from the live pool ratio', async () => {
		const rates = await getCustomTokenHbdRates();
		// 9.905 HBD / 27,000 LASSECASH
		expect(rates.LASSECASH).toBeCloseTo(9.905 / 27000, 12);
	});

	it('keys rates by UPPERCASE symbol, matching Coin.unit', async () => {
		expect(Object.keys(await getCustomTokenHbdRates())).toEqual(['LASSECASH']);
	});

	it('finds the token on either side of the pair', async () => {
		// Same pool with the sides swapped — a token alphabetically before HBD.
		fetchTypedPoolDepthsMock.mockResolvedValue({
			...LIVE_POOL,
			asset0: 'lassecash',
			asset1: 'hbd',
			reserve0: 2_700_000_000_000n,
			reserve1: 9905n
		});
		const rates = await getCustomTokenHbdRates();
		expect(rates.LASSECASH).toBeCloseTo(9.905 / 27000, 12);
	});

	it('scales each side by its own decimals', async () => {
		// 1 HBD against 1 token, where the token is 8 dp and HBD 3 dp.
		fetchTypedPoolDepthsMock.mockResolvedValue({
			...LIVE_POOL,
			reserve0: 1000n, // 1.000 HBD
			reserve1: 100_000_000n // 1.00000000 token
		});
		expect((await getCustomTokenHbdRates()).LASSECASH).toBeCloseTo(1, 12);
	});

	it('omits a pool with an empty side rather than dividing by zero', async () => {
		fetchTypedPoolDepthsMock.mockResolvedValue({ ...LIVE_POOL, reserve0: 0n });
		expect(await getCustomTokenHbdRates()).toEqual({});
	});

	it('omits a token whose pool depths are unavailable', async () => {
		fetchTypedPoolDepthsMock.mockResolvedValue(null);
		expect(await getCustomTokenHbdRates()).toEqual({});
	});

	it('returns empty rather than throwing when discovery fails', async () => {
		fetchPoolTokensMock.mockRejectedValue(new Error('indexer down'));
		expect(await getCustomTokenHbdRates()).toEqual({});
	});

	it('caches so conversions do not re-read pool state on every render', async () => {
		await getCustomTokenHbdRates();
		await getCustomTokenHbdRates();
		expect(fetchPoolTokensMock).toHaveBeenCalledTimes(1);
	});

	it('shares one in-flight load between concurrent callers', async () => {
		const [a, b] = await Promise.all([getCustomTokenHbdRates(), getCustomTokenHbdRates()]);
		expect(a).toEqual(b);
		expect(fetchPoolTokensMock).toHaveBeenCalledTimes(1);
	});

	it('re-reads after the cache is cleared', async () => {
		await getCustomTokenHbdRates();
		clearCustomTokenRateCache();
		await getCustomTokenHbdRates();
		expect(fetchPoolTokensMock).toHaveBeenCalledTimes(2);
	});
});
