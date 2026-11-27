/**
 * USD prices of the EVM bridge's assets (ETH, USDC) for the Magi balance total.
 * The HIVE/HBD/BTC feed behind CoinAmount.convertTo does not quote them, so
 * this reads CoinGecko the way the wallet tab and MarketPrices already read
 * ETH. Cached for a minute: the total is recomputed on every balance poll.
 */
export type EvmUsdPrices = { eth: number; usdc: number };

const CACHE_MS = 60_000;
let cached: { at: number; prices: EvmUsdPrices } | null = null;
let inflight: Promise<EvmUsdPrices> | null = null;

export async function fetchEvmUsdPrices(
	fetchImpl: typeof fetch = fetch,
	now: number = Date.now()
): Promise<EvmUsdPrices> {
	if (cached && now - cached.at < CACHE_MS) return cached.prices;
	if (inflight) return inflight;
	inflight = (async () => {
		try {
			const r = await fetchImpl(
				'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd'
			);
			const d = await r.json();
			const prices = {
				eth: Number(d?.ethereum?.usd) || 0,
				usdc: Number(d?.['usd-coin']?.usd) || 0
			};
			cached = { at: now, prices };
			return prices;
		} catch {
			// Keep the last good prices (or 0) for a minute rather than retrying
			// on every poll.
			const prices = cached?.prices ?? { eth: 0, usdc: 0 };
			cached = { at: now, prices };
			return prices;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

/** For tests: forget the cached prices. */
export function resetEvmUsdPriceCache() {
	cached = null;
	inflight = null;
}
