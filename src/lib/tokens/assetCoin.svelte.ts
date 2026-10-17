/**
 * Resolve an asset name, as it appears in contract payloads and indexer rows
 * (`hbd`, `hbd_savings`, `btc`, `lassecash`, …), to a display `Coin`.
 *
 * The static `Coin` table only knows the native assets, so every Magi custom
 * token used to fall through to `Coin.unk` and render as "UNK". Custom tokens
 * come from on-chain pool discovery instead (`fetchPoolTokens`), which is
 * async — so the resolved coins live in a reactive map: a row that renders
 * before discovery finishes shows UNK for a moment, then re-renders with the
 * token's real label and decimals.
 */

import { SvelteMap } from 'svelte/reactivity';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { customTokenCoin, fetchPoolTokens } from './customTokens';

const customCoins = new SvelteMap<string, Coin>();
let loading: Promise<void> | null = null;

/** True for names the static `Coin` table resolves (`hbd_savings` → hbd). */
export function isNativeAssetName(asset: string): boolean {
	const key = asset.toLowerCase().split('_')[0];
	return key !== Coin.unk.value.toLowerCase() && Object.hasOwn(Coin, key);
}

/**
 * Discover pool-backed custom tokens once per session. Every caller shares
 * one request. Discovery never throws but yields `[]` when it fails, so an
 * empty result is not cached: the next caller retries.
 */
export function loadCustomTokenCoins(): Promise<void> {
	if (!loading) {
		loading = fetchPoolTokens().then((tokens) => {
			for (const token of tokens) customCoins.set(token.symbol, customTokenCoin(token));
			if (!tokens.length) loading = null;
		});
	}
	return loading;
}

/** Display coin for an asset name; `Coin.unk` until a custom token is known.
 *  Reactive: reading it inside `$derived` re-runs once discovery lands. */
export function coinForAsset(asset: string): Coin {
	if (isNativeAssetName(asset)) {
		return Coin[asset.toLowerCase().split('_')[0] as keyof typeof Coin];
	}
	return customCoins.get(asset.toLowerCase()) ?? Coin.unk;
}
