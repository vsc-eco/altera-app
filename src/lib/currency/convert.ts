import Dinero from 'dinero.js';
import { getCryptoPrices, type Cryptoprices } from '$lib/sendswap/v4v/api-types/cryptoprices';
import { Network, Coin, type IntermediaryNetwork } from '$lib/sendswap/utils/sendOptions';
import { btcToSats, satsToBtc } from '$lib/sendswap/utils/units';
import type { CoinAmount, UnkCoinAmount } from './CoinAmount';
Dinero.defaultPrecision = 10;

/**
 * Units the price feed can quote. Anything outside this set — every Magi
 * custom token — has no exchange rate in either direction.
 *
 * Kept in step with `parseToRootedFormat`'s switch below: that throws on an
 * unknown base, which is fine as a guard but useless as UI behaviour, since
 * `convertTo` runs inside USD readouts and amount-input effects all over the
 * app. `CoinAmount.convertTo` checks this first and yields zero instead.
 */
export const PRICEABLE_UNITS: ReadonlySet<string> = new Set([
	'HIVE',
	'HBD',
	'USD',
	'BTC',
	'SATS'
]);

/** True when the price feed can quote this coin. */
export function canPrice(coin: Coin): boolean {
	return PRICEABLE_UNITS.has(coin.unit?.toUpperCase());
}
const getLightningExchangeRates = async (base: Coin) => {
	const prices = await getCryptoPrices();

	const out = parseToRootedFormat(base, prices);
	return out;
};

function parseToRootedFormat(base: Coin, prices: Cryptoprices) {
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

export async function getExchangeRates(via: IntermediaryNetwork, base: Coin) {
	if (via.value === Network.lightning.value) return await getLightningExchangeRates(base);
	throw new Error(`${via.label} network not supported.`);
}

export async function convert<FromCoinAmount extends UnkCoinAmount, ToCoin extends Coin>(
	from: FromCoinAmount,
	into: ToCoin,
	via: IntermediaryNetwork
): Promise<CoinAmount<ToCoin>> {
	return await from.convertTo(into, via);
}
