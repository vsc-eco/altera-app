import { browser } from '$app/environment';
import swapOptions, { Coin, Network } from './sendOptions';

/**
 * Persists the user's last source/target selection on swap surfaces
 * (full /swap page, dashboard QuickSwap, …) to localStorage so it
 * survives reloads. Each surface uses its own key — selections are
 * NOT shared between the dashboard and the swap page.
 */
export const SWAP_PAGE_PREF_KEY = 'altera-swap-selection-page';
export const SWAP_QUICK_PREF_KEY = 'altera-swap-selection-quick';

export type SwapSelection = {
	fromCoin?: string;
	fromNetwork?: string;
	toCoin?: string;
	toNetwork?: string;
};

export function loadSwapSelection(key: string): SwapSelection | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as SwapSelection) : null;
	} catch {
		return null;
	}
}

export function saveSwapSelection(key: string, sel: SwapSelection) {
	if (!browser) return;
	try {
		localStorage.setItem(key, JSON.stringify(sel));
	} catch {
		/* ignore quota / unavailable */
	}
}

/** Resolve the rich `from` coin option (with networks) by Coin.value. */
export function findFromOpt(coinValue: string | undefined) {
	if (!coinValue) return undefined;
	return swapOptions.from.coins.find((c) => c.coin.value === coinValue);
}

/** Resolve the rich `to` coin option (with networks) by Coin.value. */
export function findToOpt(coinValue: string | undefined) {
	if (!coinValue) return undefined;
	return swapOptions.to.coins.find((c) => c.coin.value === coinValue);
}

/** Resolve a Network instance by Network.value. */
export function findNetwork(networkValue: string | undefined) {
	if (!networkValue) return undefined;
	return Object.values(Network).find((n) => n.value === networkValue);
}
