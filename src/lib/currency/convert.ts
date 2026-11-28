import Dinero from 'dinero.js';
import { getCryptoPrices, type Cryptoprices } from '$lib/sendswap/v4v/api-types/cryptoprices';
import { fetchEvmUsdPrices } from './evmUsdPrices';
import { Network, Coin, type IntermediaryNetwork } from '$lib/sendswap/utils/sendOptions';
import { composeRates, isFeedUnit, nativeRates, type FeedPrices } from '$lib/calc';
import type { CoinAmount, UnkCoinAmount } from './CoinAmount';
import {
	getCustomTokenHbdRates,
	type CustomTokenRates
} from '$lib/tokens/customTokenRates';
Dinero.defaultPrecision = 10;

/** True when the external price feed quotes this coin directly. Everything
 *  else is a Magi custom token, priced from its own pool (customTokenRates). */
function isNativeUnit(coin: Coin): boolean {
	return isFeedUnit(coin.unit);
}

/** The feed's own shape, flattened into the one `calc` works from. */
function toFeedPrices(prices: Cryptoprices): FeedPrices {
	return {
		hiveHbd: prices.v4vapp.Hive_HBD,
		hiveUsd: prices.v4vapp.Hive_USD,
		hiveBtc: prices.hive.btc,
		satsHive: prices.v4vapp.sats_Hive,
		hbdUsd: prices.v4vapp.HBD_USD,
		hbdBtc: prices.hive_dollar.btc,
		satsHbd: prices.v4vapp.sats_HBD,
		btcUsd: prices.bitcoin.usd
	};
}

/** ETH and USDC are not in the v4v feed: their USD prices come from the
 *  shared CoinGecko helper (evmUsdPrices.ts, cached a minute, keeps the last
 *  good prices), as the Magi balance total already does. */
const EVM_UNITS: ReadonlySet<string> = new Set(['ETH', 'USDC']);

/** X per 1 unit of an ETH/USDC base: its USD price times X per USD. */
function evmRates(usdPerUnit: number, prices: Cryptoprices): Record<string, number> | null {
	// Through the one cross-rate table in `$lib/calc`, not a second one here:
	// the merge left this calling a local `nativeRates` that the math move had
	// already taken out of this file.
	const perUsd = nativeRates('USD', toFeedPrices(prices));
	if (!(usdPerUnit > 0) || !perUsd) return null;
	const out: Record<string, number> = {};
	for (const [k, v] of Object.entries(perUsd)) out[k] = usdPerUnit * v;
	out.USD = usdPerUnit;
	return out;
}

/** The rates with ETH and USDC added as targets (X per 1 base, through USD).
 *  Without them a conversion INTO ETH/USDC (a swap's rate line, 1 HBD in
 *  USDC) found no rate and showed 0. */
function withEvmTargets(
	rates: Record<string, number> | null,
	usd: { eth: number; usdc: number }
): Record<string, number> | null {
	if (!rates || !(rates.USD > 0)) return rates;
	const out = { ...rates };
	if (usd.eth > 0) out.ETH = rates.USD / usd.eth;
	if (usd.usdc > 0) out.USDC = rates.USD / usd.usdc;
	return out;
}

const getLightningExchangeRates = async (base: Coin, target?: Coin) => {
	const baseUnit = base.unit?.toUpperCase();
	const targetIsEvm = !!target && EVM_UNITS.has(target.unit?.toUpperCase());
	if (EVM_UNITS.has(baseUnit)) {
		const [prices, usd] = await Promise.all([getCryptoPrices(), fetchEvmUsdPrices()]);
		return withEvmTargets(evmRates(baseUnit === 'ETH' ? usd.eth : usd.usdc, prices), usd);
	}
	// Pool-derived rates cost chain reads, so only fetch them when a custom
	// token is actually involved. Native-to-native conversions — the vast
	// majority — keep exactly the round-trips they had before.
	const needsTokenRates = !isNativeUnit(base) || (!!target && !isNativeUnit(target));
	const [prices, tokenHbd] = await Promise.all([
		getCryptoPrices(),
		needsTokenRates ? getCustomTokenHbdRates() : Promise.resolve({} as CustomTokenRates)
	]);
	const rates = parseToRootedFormat(base, prices, tokenHbd);
	// ETH/USDC prices are only fetched when one is the target.
	return targetIsEvm ? withEvmTargets(rates, await fetchEvmUsdPrices()) : rates;
};

/**
 * Rates from `base` to every unit we can quote, or null when `base` itself is
 * unquotable (a custom token with no pool, or an empty one).
 *
 * ⚠️ The rate arithmetic — the native cross-rate table and the composition of
 * custom tokens through HBD — lives in `$lib/calc` (§4 Exchange rates). This
 * only adapts the feed's shape to it.
 */
function parseToRootedFormat(
	base: Coin,
	prices: Cryptoprices,
	tokenHbd: CustomTokenRates
): Record<string, number> | null {
	return composeRates(base.unit ?? '', toFeedPrices(prices), tokenHbd);
}

/** Rates from `base`, or null when `base` can't be quoted. `target` is a hint
 *  so we only pay for pool reads when a custom token is involved. */
export async function getExchangeRates(via: IntermediaryNetwork, base: Coin, target?: Coin) {
	if (via.value === Network.lightning.value) return await getLightningExchangeRates(base, target);
	throw new Error(`${via.label} network not supported.`);
}

/**
 * USD per 1 unit of `coin`, unrounded; 0 when the coin can't be quoted.
 *
 * Don't derive a per-unit price as `new CoinAmount(1, coin).convertTo(USD)`:
 * USD amounts carry 2 decimal places, so that rounds to whole cents and any
 * coin worth under half a cent per unit (every custom token today, LASSECASH
 * ≈ $0.0007) comes back $0, which hid its "≈ $" hints in the swap form.
 * Still rejects when the price feed itself fails, like `convertTo` does, so
 * callers can tell "unavailable" from "unpriceable".
 */
export async function usdPerUnit(coin: Coin): Promise<number> {
	if (coin.unit?.toUpperCase() === 'USD') return 1;
	const rates = await getExchangeRates(Network.lightning, coin, Coin.usd);
	const usd = rates?.USD;
	return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : 0;
}

export async function convert<FromCoinAmount extends UnkCoinAmount, ToCoin extends Coin>(
	from: FromCoinAmount,
	into: ToCoin,
	via: IntermediaryNetwork
): Promise<CoinAmount<ToCoin>> {
	return await from.convertTo(into, via);
}
