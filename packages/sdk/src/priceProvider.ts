import type { SwapAsset } from '@magi/core';
import type { PoolProvider } from './poolProvider.js';

export interface PriceProvider {
	getUsdPerUnit(asset: SwapAsset): Promise<number | null>;
}

/**
 * Derives USD prices from pool reserves using HBD ≈ $1.
 * HIVE price = HBD reserve / HIVE reserve in the HBD/HIVE pool.
 * BTC price = (HBD reserve / BTC reserve) scaled from sats/millis to whole units.
 */
export function createPoolPriceProvider(pools: PoolProvider): PriceProvider {
	let cache: { prices: Record<string, number>; at: number } | null = null;
	const TTL_MS = 10_000;

	async function refresh(): Promise<Record<string, number>> {
		const now = Date.now();
		if (cache && now - cache.at < TTL_MS) return cache.prices;

		const prices: Record<string, number> = { HBD: 1.0 };

		const hivePool = await pools.getPoolDepths('HBD', 'HIVE');
		if (hivePool) {
			const hbdR = hivePool.asset0 === 'hbd' ? hivePool.reserve0 : hivePool.reserve1;
			const hiveR = hivePool.asset0 === 'hbd' ? hivePool.reserve1 : hivePool.reserve0;
			if (hiveR > 0n) prices.HIVE = Number(hbdR) / Number(hiveR);
		}

		const btcPool = await pools.getPoolDepths('BTC', 'HBD');
		if (btcPool) {
			const btcR = btcPool.asset0 === 'btc' ? btcPool.reserve0 : btcPool.reserve1;
			const hbdR = btcPool.asset0 === 'btc' ? btcPool.reserve1 : btcPool.reserve0;
			if (btcR > 0n) {
				// btcR is sats, hbdR is milliHBD. 1 BTC = 1e8 sats. 1 HBD = 1000 millis.
				prices.BTC = (Number(hbdR) / Number(btcR)) * 100_000_000 / 1_000;
			}
		}

		cache = { prices, at: now };
		return prices;
	}

	return {
		async getUsdPerUnit(asset) {
			const prices = await refresh();
			return prices[asset] ?? null;
		}
	};
}
