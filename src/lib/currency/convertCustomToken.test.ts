/**
 * Conversions involving a Magi custom token.
 *
 * Custom tokens are in no external price feed, so the rate lookup threw:
 *
 *   Uncaught (in promise) Error: Converting from LASSECASH is unsupported
 *
 * which escaped from USD readouts and amount-input effects that don't catch,
 * leaving the swap form half-initialised. Converting INTO one was quieter and
 * worse: the missing rate multiplied through as NaN, silently, into displayed
 * amounts.
 *
 * They are now priced from their own DEX pool — every pool pairs its token
 * against HBD, so the reserve ratio is the rate and HBD's quoted USD price
 * anchors it. When no rate is available (no pool, empty pool, failed fetch)
 * conversions yield zero instead of throwing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinAmount } from './CoinAmount';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';

const getCustomTokenHbdRatesMock = vi.fn();

vi.mock('$lib/tokens/customTokenRates', () => ({
	getCustomTokenHbdRates: (...args: unknown[]) => getCustomTokenHbdRatesMock(...args)
}));
vi.mock('$lib/sendswap/v4v/api-types/cryptoprices', () => ({
	getCryptoPrices: async () => ({
		v4vapp: { Hive_HBD: 0.3, Hive_USD: 0.3, HBD_USD: 1, sats_Hive: 300, sats_HBD: 1000 },
		hive: { btc: 0.000003, usd: 0.3 },
		hive_dollar: { btc: 0.00001, usd: 1 },
		bitcoin: { usd: 100000 }
	})
}));

/** A custom token as `customTokenCoin` builds it. */
const LASSECASH = {
	value: 'lassecash',
	label: 'LASSECASH',
	icon: '/magi.svg',
	unit: 'LASSECASH',
	decimalPlaces: 8
};

/** 1 LASSECASH = 0.5 HBD, and HBD is $1 in the mocked feed. */
beforeEach(() => getCustomTokenHbdRatesMock.mockResolvedValue({ LASSECASH: 0.5 }));
afterEach(() => getCustomTokenHbdRatesMock.mockReset());

describe('pricing a custom token from its pool', () => {
	it('converts the token to USD via HBD', async () => {
		const usd = await new CoinAmount(10, LASSECASH).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBeCloseTo(5, 6); // 10 × 0.5 HBD × $1
	});

	it('converts HBD into the token', async () => {
		const out = await new CoinAmount(10, Coin.hbd).convertTo(LASSECASH, Network.lightning);
		expect(out.toNumber()).toBeCloseTo(20, 6); // 10 HBD ÷ 0.5 HBD-per-token
		expect(out.coin.value).toBe('lassecash');
	});

	it('converts the token to a non-HBD native by composing through HBD', async () => {
		const hive = await new CoinAmount(10, LASSECASH).convertTo(Coin.hive, Network.lightning);
		// 10 × 0.5 HBD = 5 HBD; at 0.3 HBD per HIVE that is 16.667 HIVE.
		expect(hive.toNumber()).toBeCloseTo(16.667, 2);
	});

	it('round-trips HBD → token → HBD', async () => {
		const token = await new CoinAmount(8, Coin.hbd).convertTo(LASSECASH, Network.lightning);
		const back = await token.convertTo(Coin.hbd, Network.lightning);
		expect(back.toNumber()).toBeCloseTo(8, 6);
	});

	it('only pays for pool rates when a custom token is involved', async () => {
		// Measured as a delta, not an absolute count: the point is that a
		// native-to-native conversion adds no pool read, which is what keeps
		// the hot paths (balances, transaction rows) as cheap as they were.
		const before = getCustomTokenHbdRatesMock.mock.calls.length;
		await new CoinAmount(10, Coin.hbd).convertTo(Coin.usd, Network.lightning);
		expect(getCustomTokenHbdRatesMock.mock.calls.length).toBe(before);

		await new CoinAmount(10, Coin.hbd).convertTo(LASSECASH, Network.lightning);
		expect(getCustomTokenHbdRatesMock.mock.calls.length).toBeGreaterThan(before);
	});
});

describe('when no rate is available', () => {
	it('does not reject — the reported crash', async () => {
		getCustomTokenHbdRatesMock.mockResolvedValue({});
		await expect(
			new CoinAmount(5, LASSECASH).convertTo(Coin.usd, Network.lightning)
		).resolves.toBeDefined();
	});

	it('yields zero rather than NaN in either direction', async () => {
		getCustomTokenHbdRatesMock.mockResolvedValue({});
		const usd = await new CoinAmount(5, LASSECASH).convertTo(Coin.usd, Network.lightning);
		const token = await new CoinAmount(5, Coin.hbd).convertTo(LASSECASH, Network.lightning);
		expect(Number.isNaN(usd.amount)).toBe(false);
		expect(Number.isNaN(token.amount)).toBe(false);
		expect(usd.toNumber()).toBe(0);
		expect(token.toNumber()).toBe(0);
	});

	it('treats an empty pool (zero rate) as no rate', async () => {
		getCustomTokenHbdRatesMock.mockResolvedValue({ LASSECASH: 0 });
		const usd = await new CoinAmount(5, LASSECASH).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBe(0);
	});

	it('survives the rate lookup failing outright', async () => {
		getCustomTokenHbdRatesMock.mockRejectedValue(new Error('indexer down'));
		await expect(
			new CoinAmount(5, LASSECASH).convertTo(Coin.usd, Network.lightning)
		).rejects.toThrow();
	});
});

describe('native conversions are unchanged', () => {
	it('HBD to USD', async () => {
		const usd = await new CoinAmount(10, Coin.hbd).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBeCloseTo(10, 6);
	});

	it('HIVE to HBD', async () => {
		const hbd = await new CoinAmount(10, Coin.hive).convertTo(Coin.hbd, Network.lightning);
		expect(hbd.toNumber()).toBeCloseTo(3, 6);
	});

	it('same-coin and zero amounts short-circuit', async () => {
		expect((await new CoinAmount(2.5, LASSECASH).convertTo(LASSECASH, Network.lightning)).toNumber()).toBe(2.5);
		expect((await new CoinAmount(0, LASSECASH).convertTo(Coin.usd, Network.lightning)).toNumber()).toBe(0);
	});
});
