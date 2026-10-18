import Dinero from 'dinero.js';
import { getCryptoPrices, type Cryptoprices } from '$lib/sendswap/v4v/api-types/cryptoprices';
import { Network, Coin, type IntermediaryNetwork } from '$lib/sendswap/utils/sendOptions';
import { btcToSats, satsToBtc } from '$lib/sendswap/utils/units';
import type { CoinAmount, UnkCoinAmount } from './CoinAmount';
import {
	getCustomTokenHbdRates,
	type CustomTokenRates
} from '$lib/tokens/customTokenRates';
Dinero.defaultPrecision = 10;

/** Units the external price feed quotes directly. Everything else is a Magi
 *  custom token, priced from its own pool instead (see customTokenRates). */
const NATIVE_UNITS: ReadonlySet<string> = new Set(['HIVE', 'HBD', 'USD', 'BTC', 'SATS']);

function isNativeUnit(coin: Coin): boolean {
	return NATIVE_UNITS.has(coin.unit?.toUpperCase());
}

const getLightningExchangeRates = async (base: Coin, target?: Coin) => {
	// Pool-derived rates cost chain reads, so only fetch them when a custom
	// token is actually involved. Native-to-native conversions — the vast
	// majority — keep exactly the round-trips they had before.
	const needsTokenRates = !isNativeUnit(base) || (!!target && !isNativeUnit(target));
	const [prices, tokenHbd] = await Promise.all([
		getCryptoPrices(),
		needsTokenRates ? getCustomTokenHbdRates() : Promise.resolve({} as CustomTokenRates)
	]);
	return parseToRootedFormat(base, prices, tokenHbd);
};

function nativeRates(unit: string, prices: Cryptoprices): Record<string, number> | null {
	switch (unit) {
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
			return null;
	}
}

/**
 * Rates from `base` to every unit we can quote, or null when `base` itself is
 * unquotable (a custom token with no pool, or an empty one).
 *
 * Custom tokens compose through HBD, which is how the DEX itself is laid out:
 *   - from a native base: tokens per base = (HBD per base) / (HBD per token)
 *   - from a token base:  X per token = (HBD per token) × (X per HBD)
 */
function parseToRootedFormat(
	base: Coin,
	prices: Cryptoprices,
	tokenHbd: CustomTokenRates
): Record<string, number> | null {
	const unit = base.unit?.toUpperCase();
	const native = nativeRates(unit, prices);

	if (native) {
		const out: Record<string, number> = { ...native };
		for (const [tokenUnit, hbdPerToken] of Object.entries(tokenHbd)) {
			if (hbdPerToken > 0) out[tokenUnit] = native.HBD / hbdPerToken;
		}
		return out;
	}

	const hbdPerToken = tokenHbd[unit];
	if (!hbdPerToken || hbdPerToken <= 0) return null;

	const hbdRates = nativeRates('HBD', prices);
	if (!hbdRates) return null;

	const out: Record<string, number> = {};
	for (const [k, perHbd] of Object.entries(hbdRates)) out[k] = hbdPerToken * perHbd;
	// Token-to-token goes through HBD as well.
	for (const [tokenUnit, otherHbd] of Object.entries(tokenHbd)) {
		if (otherHbd > 0) out[tokenUnit] = hbdPerToken / otherHbd;
	}
	return out;
}

/** Rates from `base`, or null when `base` can't be quoted. `target` is a hint
 *  so we only pay for pool reads when a custom token is involved. */
export async function getExchangeRates(via: IntermediaryNetwork, base: Coin, target?: Coin) {
	if (via.value === Network.lightning.value) return await getLightningExchangeRates(base, target);
	throw new Error(`${via.label} network not supported.`);
}

export async function convert<FromCoinAmount extends UnkCoinAmount, ToCoin extends Coin>(
	from: FromCoinAmount,
	into: ToCoin,
	via: IntermediaryNetwork
): Promise<CoinAmount<ToCoin>> {
	return await from.convertTo(into, via);
}
