import Dinero from 'dinero.js';
import { getCryptoPrices, type Cryptoprices } from '$lib/send/v4v/api-types/cryptoprices';
import { Network, type IntermediaryNetwork, type UnknownCoin } from '$lib/send/sendOptions';
import { btcToSats, satsToBtc } from '$lib/send/units';
import type { CoinAmount, UnkCoinAmount } from './CoinAmount';
Dinero.defaultPrecision = 10;
const getLightningExchangeRates = async (base: UnknownCoin) => {
	const prices = await getCryptoPrices();

	const out = parseToRootedFormat(base, prices);
	return out;
};

function parseToRootedFormat(base: UnknownCoin, prices: Cryptoprices) {
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
				HIVE: satsToBtc(prices.hive.btc),
				HBD: satsToBtc(prices.hive_dollar.btc),
				USD: satsToBtc(prices.bitcoin.usd),
				BTC: satsToBtc(1),
				SATS: 1
			};

		default:
			throw Error(`Converting from ${base.unit} is unsupported`);
	}
}

export async function getExchangeRates(via: IntermediaryNetwork, base: UnknownCoin) {
	if (via == Network.lightning) return await getLightningExchangeRates(base);
	throw new Error(`${via.label} network not supported.`);
}

export async function convert<FromCoinAmount extends UnkCoinAmount, ToCoin extends UnknownCoin>(
	from: FromCoinAmount,
	into: ToCoin,
	via: IntermediaryNetwork
): Promise<CoinAmount<ToCoin>> {
	return await from.convertTo(into, via);
}
