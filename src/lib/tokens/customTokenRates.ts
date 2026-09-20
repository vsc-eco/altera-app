/**
 * Exchange rates for Magi custom tokens, derived from their own DEX pool.
 *
 * Custom tokens are in no price feed — the v4v/CoinGecko data covers
 * HIVE/HBD/BTC only — so every USD figure for them read $0. But the price is
 * already on chain: every pool pairs its token against HBD (the DEX base
 * asset), so the reserve ratio IS the exchange rate, and HBD has a real quoted
 * USD price to anchor it to.
 *
 * Rates are expressed as HBD per 1 token, which is the form the conversion
 * table wants: everything else is reached by composing with HBD's own rates.
 *
 * This is a market price from a single pool, so it is only as good as that
 * pool's depth — a thin pool is easily moved. Fine for a display estimate,
 * which is all it is used for; swap amounts come from the quote, never here.
 */

import { fetchPoolTokens } from './customTokens';
import { fetchTypedPoolDepths, DEX_BASE_ASSET } from '$lib/pools/swapCalc';

/** Decimal places for HBD, the asset every pool is quoted against. */
const HBD_DECIMALS = 3;

/** HBD per 1 token, keyed by UPPERCASE symbol (matching `Coin.unit`). */
export type CustomTokenRates = Record<string, number>;

/**
 * Reserve ratios move slowly and this is display-only, so a short cache keeps
 * conversions from re-reading pool state on every render. Conversions happen
 * constantly (balances, transaction rows, amount inputs).
 */
const TTL_MS = 60_000;
let cache: { at: number; rates: CustomTokenRates } | null = null;
let inFlight: Promise<CustomTokenRates> | null = null;

async function loadRates(): Promise<CustomTokenRates> {
	const rates: CustomTokenRates = {};
	try {
		const tokens = await fetchPoolTokens();
		if (tokens.length === 0) return rates;

		const depths = await Promise.all(
			tokens.map((t) => fetchTypedPoolDepths(t.symbol, DEX_BASE_ASSET).catch(() => null))
		);

		tokens.forEach((token, i) => {
			const pool = depths[i];
			if (!pool) return;

			// The pool normalises its pair alphabetically, so which side holds
			// the token depends on its symbol — resolve by name, not position.
			const tokenIsAsset0 = pool.asset0 === token.symbol;
			const tokenRaw = tokenIsAsset0 ? pool.reserve0 : pool.reserve1;
			const hbdRaw = tokenIsAsset0 ? pool.reserve1 : pool.reserve0;
			if (tokenRaw <= 0n || hbdRaw <= 0n) return;

			const tokenAmount = Number(tokenRaw) / 10 ** token.decimals;
			const hbdAmount = Number(hbdRaw) / 10 ** HBD_DECIMALS;
			if (!(tokenAmount > 0) || !(hbdAmount > 0)) return;

			const hbdPerToken = hbdAmount / tokenAmount;
			if (Number.isFinite(hbdPerToken) && hbdPerToken > 0) {
				rates[token.label.toUpperCase()] = hbdPerToken;
			}
		});
	} catch (err) {
		// No rate is recoverable — callers fall back to zero, same as before.
		console.error('Failed to derive custom token rates', err);
	}
	return rates;
}

/** HBD per 1 token for every pool-backed custom token. Never throws. */
export function getCustomTokenHbdRates(): Promise<CustomTokenRates> {
	if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.rates);
	if (inFlight) return inFlight;
	inFlight = loadRates()
		.then((rates) => {
			cache = { at: Date.now(), rates };
			return rates;
		})
		.finally(() => {
			inFlight = null;
		});
	return inFlight;
}

/** Drop the cached rates — for tests, and after anything that moves reserves. */
export function clearCustomTokenRateCache(): void {
	cache = null;
	inFlight = null;
}
