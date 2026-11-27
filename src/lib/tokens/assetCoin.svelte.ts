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
import { customTokenCoin, customTokenIcon, fetchPoolTokens, fetchTokenRegistry } from './customTokens';

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

// ── Token contracts ────────────────────────────────────────────────────────
//
// A transaction names the CONTRACT it called, never the symbol, and the same
// symbol can live on two contracts — so a transfer can only be read as "0.3
// STARPRO" by looking the contract up. Reactive for the same reason as above:
// the row renders before discovery lands, then re-renders with the token.

const tokenContracts = new SvelteMap<string, Coin>();
let registryLoading: Promise<void> | null = null;

/** Discover every magi_token contract once per session. Shared by all callers,
 *  never throws, and an empty result is not cached so the next caller retries. */
export function loadTokenContracts(): Promise<void> {
	if (!registryLoading) {
		registryLoading = fetchTokenRegistry().then((tokens) => {
			for (const token of tokens) {
				tokenContracts.set(token.contractId, {
					value: token.symbol,
					label: token.label,
					icon: customTokenIcon(token.symbol),
					unit: token.label,
					decimalPlaces: token.decimals
				});
				// Also by symbol, so `coinForAsset` resolves a token with no pool.
				if (!customCoins.has(token.symbol)) customCoins.set(token.symbol, tokenContracts.get(token.contractId)!);
			}
			if (!tokens.length) registryLoading = null;
		});
	}
	return registryLoading;
}

/** The token held by a contract, or undefined when it is not one (or when
 *  discovery has not landed yet). Reactive: reading it inside `$derived`
 *  re-runs once the registry arrives. */
export function tokenForContract(contractId: string | undefined | null): Coin | undefined {
	if (!contractId) return undefined;
	return tokenContracts.get(contractId);
}
