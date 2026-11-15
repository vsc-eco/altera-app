import { describe, expect, it } from 'vitest';
import { ASSET_ACTIONS, assetActionHref, coinParamFor, supportsCoin } from './assetActions';
import { Coin } from '$lib/sendswap/utils/sendOptions';

describe('assetActions', () => {
	it('supports the assets with a mainnet rail everywhere', () => {
		for (const coin of [Coin.hive.value, Coin.hbd.value, Coin.btc.value]) {
			for (const action of ASSET_ACTIONS) expect(supportsCoin(action, coin)).toBe(true);
		}
	});

	/** sHBD stays transferable while earning, but cannot move in or out on a
	 *  rail of its own. */
	it('supports sHBD for transfer only', () => {
		expect(supportsCoin('transfer', Coin.shbd.value)).toBe(true);
		expect(supportsCoin('deposit', Coin.shbd.value)).toBe(false);
		expect(supportsCoin('withdraw', Coin.shbd.value)).toBe(false);
	});

	it('supports nothing for staked, unstaking or unknown values', () => {
		for (const v of ['hive_consensus', 'consensus_unstaking', undefined, '']) {
			for (const action of ASSET_ACTIONS) expect(supportsCoin(action, v)).toBe(false);
		}
	});

	it('keeps a stable display order', () => {
		expect(ASSET_ACTIONS).toEqual(['transfer', 'deposit', 'withdraw']);
	});

	/** The header buttons are asset-agnostic: no coin, no query string. */
	it('links to the bare wallet tab when no asset is named', () => {
		expect(assetActionHref('transfer')).toBe('/transfer');
		expect(assetActionHref('deposit')).toBe('/deposit');
		expect(assetActionHref('withdraw')).toBe('/withdraw');
	});

	it('names the asset when the flow can handle it', () => {
		expect(assetActionHref('deposit', Coin.hbd.value)).toBe('/deposit?coin=hbd');
		expect(assetActionHref('transfer', Coin.shbd.value)).toBe('/transfer?coin=hbd_savings');
		expect(assetActionHref('withdraw', Coin.btc.value)).toBe('/withdraw?coin=btc');
	});

	/** Passing a coin the flow cannot handle must not produce a dead link. */
	it('drops an unusable coin instead of passing it on', () => {
		expect(assetActionHref('deposit', Coin.shbd.value)).toBe('/deposit');
		expect(assetActionHref('withdraw', 'eth')).toBe('/withdraw');
	});

	describe('coinParamFor', () => {
		it('accepts a coin the flow supports', () => {
			expect(coinParamFor('transfer', Coin.shbd.value)).toBe('hbd_savings');
			expect(coinParamFor('deposit', Coin.btc.value)).toBe('btc');
		});

		/** A stale or hand-typed URL must fall back to the flow's own default
		 *  rather than leaving the picker on nothing. */
		it('rejects a coin the flow cannot handle', () => {
			expect(coinParamFor('deposit', Coin.shbd.value)).toBeUndefined();
			expect(coinParamFor('withdraw', 'eth')).toBeUndefined();
			expect(coinParamFor('transfer', 'nonsense')).toBeUndefined();
		});

		it('is undefined when there is no param at all', () => {
			expect(coinParamFor('transfer', null)).toBeUndefined();
			expect(coinParamFor('transfer', '')).toBeUndefined();
			expect(coinParamFor('transfer', undefined)).toBeUndefined();
		});
	});
});
