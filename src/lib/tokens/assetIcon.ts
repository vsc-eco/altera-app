/**
 * Icon for a DEX asset symbol, as pool pairs name them (`HBD`, `LASSECASH`).
 *
 * The pool views each carried their own BTC/HBD/HIVE-only lookup, so every
 * custom token fell through to a lettered placeholder even when we had its
 * logo. Undefined for a custom token with no known artwork, so callers keep
 * their own fallback — in a pair list a lettered badge says more than the
 * generic Magi mark would.
 */

import { Coin } from '$lib/sendswap/utils/sendOptions';
import { knownTokenIcon } from './customTokens';

export function assetIcon(symbol: string): string | undefined {
	switch (symbol?.toUpperCase()) {
		case 'BTC':
			return Coin.btc.icon;
		case 'HBD':
			return Coin.hbd.icon;
		case 'HIVE':
			return Coin.hive.icon;
	}
	return knownTokenIcon(symbol);
}
