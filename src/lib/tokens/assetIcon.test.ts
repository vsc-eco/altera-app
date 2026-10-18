/**
 * The pool views (pools table, My liquidity, Remove liquidity) render pair
 * icons through `assetIcon`. Before it existed they each had a native-only
 * lookup, so LASSECASH showed a lettered "LAS" badge despite having a logo.
 */

import { describe, expect, it } from 'vitest';
import { assetIcon } from './assetIcon';
import { customTokenIcon } from './customTokens';
import { Coin } from '$lib/sendswap/utils/sendOptions';

describe('assetIcon', () => {
	it('gives the native assets their own icons, in either case', () => {
		expect(assetIcon('HBD')).toBe(Coin.hbd.icon);
		expect(assetIcon('hive')).toBe(Coin.hive.icon);
		expect(assetIcon('BTC')).toBe(Coin.btc.icon);
	});

	it('gives a custom token with known artwork its logo', () => {
		expect(assetIcon('LASSECASH')).toBe('https://lassecash.com/logo/lassecash-circle-512.png');
		// Same artwork the swap and add-liquidity forms use.
		expect(assetIcon('LASSECASH')).toBe(customTokenIcon('lassecash'));
	});

	it('is undefined for an unknown token, so callers keep their own fallback', () => {
		expect(assetIcon('DIY')).toBeUndefined();
		expect(assetIcon('')).toBeUndefined();
	});
});
