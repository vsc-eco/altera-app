/**
 * Conversions involving an asset the price feed cannot quote.
 *
 * `parseToRootedFormat` switches over HIVE/HBD/USD/BTC/SATS and threw on
 * anything else, so a Magi custom token produced:
 *
 *   Uncaught (in promise) Error: Converting from LASSECASH is unsupported
 *
 * That matters because `convertTo` is called from USD readouts and amount-input
 * effects that don't catch — an HBD→LASSECASH swap threw from the TO input's
 * USD readout and left the component half-initialised.
 *
 * Converting INTO such a coin was worse: the rate lookup returned undefined and
 * multiplied through as NaN, silently, into displayed amounts.
 *
 * Both now yield zero. Zero is honest here ("no known value"); NaN and a
 * rejected promise are not.
 */
import { describe, expect, it, vi } from 'vitest';
import { CoinAmount } from './CoinAmount';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { canPrice } from './convert';

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

describe('canPrice', () => {
	it('covers exactly the units the feed quotes', () => {
		for (const c of [Coin.hive, Coin.hbd, Coin.btc, Coin.sats, Coin.usd]) {
			expect(canPrice(c), c.unit).toBe(true);
		}
		expect(canPrice(LASSECASH)).toBe(false);
	});
});

describe('convertTo with a custom token', () => {
	it('does not reject converting FROM it — the reported crash', async () => {
		const amt = new CoinAmount(5, LASSECASH);
		await expect(amt.convertTo(Coin.usd, Network.lightning)).resolves.toBeDefined();
	});

	it('yields zero rather than NaN converting INTO it', async () => {
		const out = await new CoinAmount(10, Coin.hbd).convertTo(LASSECASH, Network.lightning);
		expect(Number.isNaN(out.amount)).toBe(false);
		expect(out.amount).toBe(0);
		expect(out.coin.value).toBe('lassecash');
	});

	it('reports zero USD rather than throwing', async () => {
		const usd = await new CoinAmount(5, LASSECASH).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBe(0);
		expect(usd.coin.value).toBe(Coin.usd.value);
	});

	it('still returns the same amount for a same-coin conversion', async () => {
		const amt = new CoinAmount(2.5, LASSECASH);
		const out = await amt.convertTo(LASSECASH, Network.lightning);
		expect(out.toNumber()).toBe(2.5);
	});

	it('leaves zero amounts alone', async () => {
		const out = await new CoinAmount(0, LASSECASH).convertTo(Coin.usd, Network.lightning);
		expect(out.toNumber()).toBe(0);
	});
});

describe('convertTo between native coins is unchanged', () => {
	it('still converts HBD to USD at the feed rate', async () => {
		const usd = await new CoinAmount(10, Coin.hbd).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBeCloseTo(10, 6);
	});

	it('still converts HIVE to HBD at the feed rate', async () => {
		const hbd = await new CoinAmount(10, Coin.hive).convertTo(Coin.hbd, Network.lightning);
		expect(hbd.toNumber()).toBeCloseTo(3, 6);
	});
});
