/**
 * ETH and USDC amounts get a USD value (the deposit page's "Approx. USD value"
 * showed $0 for them: the v4v feed quotes only HIVE/HBD/BTC).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/sendswap/v4v/api-types/cryptoprices', () => ({
	getCryptoPrices: async () => ({
		hive: { usd: 0.2, btc: 0.000002 },
		hive_dollar: { usd: 1, btc: 0.00001 },
		bitcoin: { usd: 100_000, btc: 1 },
		v4vapp: { Hive_HBD: 0.2, Hive_USD: 0.2, HBD_USD: 1, sats_Hive: 200, sats_HBD: 1000 }
	})
}));
const prices = vi.hoisted(() => ({ eth: 1620, usdc: 0.9998 }));
vi.mock('./evmUsdPrices', () => ({ fetchEvmUsdPrices: async () => prices }));

const { CoinAmount } = await import('./CoinAmount');
const { Coin, Network } = await import('$lib/sendswap/utils/sendOptions');
const { usdPerUnit } = await import('./convert');

describe('ETH and USDC in USD', () => {
	it('0.5 ETH is 0.5 x the ETH price', async () => {
		const usd = await new CoinAmount('0.5', Coin.eth).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBe(810);
		expect(await usdPerUnit(Coin.eth)).toBe(1620);
	});

	it('100 USDC is about 100 USD', async () => {
		const usd = await new CoinAmount('100', Coin.usdc).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBe(99.98);
	});

	it('no ETH price (CoinGecko down, nothing cached): no value instead of a wrong one', async () => {
		prices.eth = 0;
		const usd = await new CoinAmount('1', Coin.eth).convertTo(Coin.usd, Network.lightning);
		expect(usd.toNumber()).toBe(0);
		prices.eth = 1620;
	});

	it('HIVE and HBD are unchanged', async () => {
		expect(
			(await new CoinAmount('10', Coin.hive).convertTo(Coin.usd, Network.lightning)).toNumber()
		).toBe(2);
		expect(
			(await new CoinAmount('3', Coin.hbd).convertTo(Coin.usd, Network.lightning)).toNumber()
		).toBe(3);
	});

	it('into USDC and ETH: 1 HBD in USDC, 1 USDC in ETH (the swap rate line)', async () => {
		const usdc = await new CoinAmount('1', Coin.hbd).convertTo(Coin.usdc, Network.lightning);
		expect(usdc.toNumber()).toBeCloseTo(1 / 0.9998, 6);
		const eth = await new CoinAmount('1620', Coin.usdc).convertTo(Coin.eth, Network.lightning);
		expect(eth.toNumber()).toBeCloseTo(0.9998, 6);
	});

	it('into ETH with no ETH price: 0, never a wrong number', async () => {
		prices.eth = 0;
		const eth = await new CoinAmount('1', Coin.hbd).convertTo(Coin.eth, Network.lightning);
		expect(eth.toNumber()).toBe(0);
		prices.eth = 1620;
	});
});

describe('amounts as text', () => {
	it('ETH drops trailing zeros (a list row read "0.062270000000000000 ETH"); 8 places or fewer keep them', () => {
		expect(new CoinAmount(62_270_000_000_000_000, Coin.eth, true).toPrettyAmountString()).toBe('0.06227');
		expect(new CoinAmount(100_000, Coin.hbd, true).toPrettyAmountString()).toBe('100.000');
		expect(new CoinAmount(320_000, Coin.btc, true).toPrettyAmountString()).toBe('0.00320000');
		expect(new CoinAmount(99_850_000, Coin.usdc, true).toPrettyAmountString()).toBe('99.850000');
	});
});

