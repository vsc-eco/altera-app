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
});
