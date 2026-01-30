import Dinero from 'dinero.js';
import { getCryptoPrices, type Cryptoprices } from '$lib/sendswap/v4v/api-types/cryptoprices';
import { Network, Coin, type IntermediaryNetwork } from '$lib/sendswap/utils/sendOptions';
import { btcToSats, satsToBtc } from '$lib/sendswap/utils/units';
import type { CoinAmount, UnkCoinAmount } from './CoinAmount';

Dinero.defaultPrecision = 10;

/**
 * CoinMarketCap price map
 */
type CmcPriceMap = Record<
	string,
	{
		USD: number;
	}
>;

type RootedRates = {
	HIVE: number;
	HBD: number;
	USD: number;
	BTC: number;
	SATS: number;
};

// In-flight request deduplication only (no cache): same IDs requested at same time = one API call
const pendingRequests = new Map<string, Promise<CmcPriceMap>>();

/**
 * Fetch latest prices from CoinMarketCap. No cache — fresh data on each reload.
 */
async function getLatestPrices(coins: Coin[]): Promise<CmcPriceMap> {
	const ids = coins
		.map((coin) => (coin.ucid ? Number(coin.ucid) : NaN))
		.filter((id): id is number => Number.isFinite(id));

	if (ids.length === 0) {
		throw new Error('No valid UCIDs provided for CoinMarketCap lookup');
	}

	const cacheKey = ids.sort().join(',');

	const pending = pendingRequests.get(cacheKey);
	if (pending) {
		return pending;
	}

	const requestPromise = (async () => {
		try {
			const response = await fetch(`/api/coin-market-latest?id=${ids.join(',')}`);
			const data = await response.json();

			if (!data.data || Object.keys(data.data).length === 0) {
				throw new Error('No price data returned from CoinMarketCap API');
			}

			const prices: CmcPriceMap = {};
			Object.values(data.data).forEach((coin: any) => {
				if (coin.quote && coin.quote.USD && coin.quote.USD.price !== undefined) {
					prices[coin.symbol] = {
						USD: coin.quote.USD.price
					};
				} else {
					console.warn(`Missing price data for ${coin.symbol} (ID: ${coin.id})`);
				}
			});

			return prices;
		} finally {
			pendingRequests.delete(cacheKey);
		}
	})();

	pendingRequests.set(cacheKey, requestPromise);
	return requestPromise;
}

/**
 * Convert CoinMarketCap prices into rooted exchange rates
 */
function parseToRootedFormatFromCMC(base: Coin, prices: CmcPriceMap): RootedRates {
	const btcUsd = prices.BTC?.USD;
	const hiveUsd = prices.HIVE?.USD;
	const hbdUsd = prices.HBD?.USD;

	if (!btcUsd) throw new Error('BTC price missing from CoinMarketCap response');
	if (!hiveUsd) throw new Error('HIVE price missing from CoinMarketCap response');
	if (!hbdUsd) throw new Error('HBD price missing from CoinMarketCap response');

	switch (base.unit) {
		case 'HIVE': {
			const btcPerHive = hiveUsd / btcUsd;
			return {
				HIVE: 1,
				HBD: hiveUsd / hbdUsd,
				USD: hiveUsd,
				BTC: btcPerHive,
				SATS: btcToSats(btcPerHive)
			};
		}
		case 'HBD': {
			const btcPerHbd = hbdUsd / btcUsd;
			return {
				HIVE: hbdUsd / hiveUsd,
				HBD: 1,
				USD: hbdUsd,
				BTC: btcPerHbd,
				SATS: btcToSats(btcPerHbd)
			};
		}
		case 'USD': {
			return {
				HIVE: 1 / hiveUsd,
				HBD: 1 / hbdUsd,
				USD: 1,
				BTC: 1 / btcUsd,
				// sats per 1 USD
				SATS: btcToSats(1 / btcUsd)
			};
		}
		case 'BTC': {
			return {
				HIVE: btcUsd / hiveUsd,
				HBD: btcUsd / hbdUsd,
				USD: btcUsd,
				BTC: 1,
				SATS: btcToSats(1)
			};
		}
		case 'SATS': {
			// 1 sat = 1e-8 BTC
			return {
				HIVE: btcUsd / hiveUsd / 100_000_000,
				HBD: btcUsd / hbdUsd / 100_000_000,
				USD: btcUsd / 100_000_000,
				BTC: 1 / 100_000_000,
				SATS: 1
			};
		}
		default:
			throw new Error(`Converting from ${base.unit} is unsupported via CoinMarketCap`);
	}
}

/**
 * Parse v4v cryptoprices into rooted exchange rates
 */
function parseToRootedFormat(base: Coin, prices: Cryptoprices): RootedRates {
	switch (base.unit) {
		case 'HIVE':
			return {
				HIVE: 1,
				HBD: prices.v4vapp.Hive_HBD,
				USD: prices.v4vapp.Hive_USD,
				BTC: prices.hive.btc,
				SATS: prices.v4vapp.sats_Hive
			};
		case 'HBD':
			return {
				HIVE: 1 / prices.v4vapp.Hive_HBD,
				HBD: 1,
				USD: prices.v4vapp.HBD_USD,
				BTC: prices.hive_dollar.btc,
				SATS: prices.v4vapp.sats_HBD
			};
		case 'USD':
			return {
				HIVE: 1 / prices.hive.usd,
				HBD: 1 / prices.hive_dollar.usd,
				USD: 1,
				BTC: 1 / prices.bitcoin.usd,
				SATS: satsToBtc(prices.bitcoin.usd)
			};
		case 'BTC':
			return {
				HIVE: 1 / prices.hive.btc,
				HBD: 1 / prices.hive_dollar.btc,
				USD: prices.bitcoin.usd,
				BTC: 1,
				SATS: btcToSats(1)
			};

		case 'SATS':
			return {
				HIVE: satsToBtc(1 / prices.hive.btc),
				HBD: satsToBtc(1 / prices.hive_dollar.btc),
				USD: satsToBtc(prices.bitcoin.usd),
				BTC: satsToBtc(1),
				SATS: 1
			};

		default:
			throw Error(`Converting from ${base.unit} is unsupported`);
	}
}

/**
 * Lightning exchange rates: try v4v API first, fallback to CoinMarketCap
 */
const getLightningExchangeRates = async (base: Coin) => {
	try {
		const prices = await getCryptoPrices();
		return parseToRootedFormat(base, prices);
	} catch (err) {
		// commented this out because it kinda spams it a lot if it fails...
		// console.warn('v4v cryptoprices API failed, falling back to CoinMarketCap:', err);
		const prices = await getLatestPrices([Coin.btc, Coin.hive, Coin.hbd]);
		return parseToRootedFormatFromCMC(base, prices);
	}
};

export async function getExchangeRates(via: IntermediaryNetwork, base: Coin) {
	if (via === Network.lightning) {
		return await getLightningExchangeRates(base);
	}
	throw new Error(`${via.label} network not supported.`);
}

export async function convert<FromCoinAmount extends UnkCoinAmount, ToCoin extends Coin>(
	from: FromCoinAmount,
	into: ToCoin,
	via: IntermediaryNetwork
): Promise<CoinAmount<ToCoin>> {
	return await from.convertTo(into, via);
}
