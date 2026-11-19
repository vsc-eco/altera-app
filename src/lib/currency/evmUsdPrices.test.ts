import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEvmUsdPrices, resetEvmUsdPriceCache } from './evmUsdPrices';

const ok = (body: object) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

beforeEach(() => resetEvmUsdPriceCache());

describe('fetchEvmUsdPrices', () => {
	it('reads ETH and USDC from one CoinGecko answer', async () => {
		const f = ok({ ethereum: { usd: 1785.6 }, 'usd-coin': { usd: 0.9998 } });
		expect(await fetchEvmUsdPrices(f, 1000)).toEqual({ eth: 1785.6, usdc: 0.9998 });
	});

	it('asks once a minute, not on every balance poll', async () => {
		const f = ok({ ethereum: { usd: 1 }, 'usd-coin': { usd: 1 } });
		await fetchEvmUsdPrices(f, 1000);
		await fetchEvmUsdPrices(f, 30_000);
		expect(f).toHaveBeenCalledTimes(1);
		await fetchEvmUsdPrices(f, 61_001);
		expect(f).toHaveBeenCalledTimes(2);
	});

	it('keeps the last good prices when CoinGecko fails', async () => {
		await fetchEvmUsdPrices(ok({ ethereum: { usd: 2000 }, 'usd-coin': { usd: 1 } }), 1000);
		const failing = vi.fn(async () => {
			throw new Error('429');
		}) as unknown as typeof fetch;
		expect(await fetchEvmUsdPrices(failing, 70_000)).toEqual({ eth: 2000, usdc: 1 });
	});
});
