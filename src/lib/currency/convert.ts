import Dinero from 'dinero.js';
import { getCryptoPrices, type Cryptoprices } from '$lib/send/v4v/api-types/cryptoprices';
import { Network, Coin } from '$lib/send/sendOptions';
import { btcToSats, satsToBtc } from '$lib/send/units';
Dinero.defaultPrecision = 10;
const getLightningExchangeRates = async (base: Coin) => {
	let prices = await getCryptoPrices();

	let out = parseToRootedFormat(base, prices);
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

export async function convert(
	fromAmount: number,
	from: Coin,
	into: Coin,
	via: Network
): Promise<number> {
	if (from.unit == into.unit) return fromAmount;
	console.warn(`converting from ${from.unit} to ${into.unit}`);
	if (via == Network.lightning) {
		let rates = await getLightningExchangeRates(from);
		return fromAmount * rates[into.unit as keyof typeof rates];
	}
	throw Error(`${via.label} network not supported`);
}
