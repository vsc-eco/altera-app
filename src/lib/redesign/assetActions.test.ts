import { describe, expect, it } from 'vitest';
import { ASSET_ACTIONS, actionsForCoin, assetActionHref, coinParamFor } from './assetActions';
import { Coin } from '$lib/sendswap/utils/sendOptions';

describe('assetActions', () => {
	it('offers all three actions for the assets with a mainnet rail', () => {
		for (const coin of [Coin.hive.value, Coin.hbd.value, Coin.btc.value]) {
			expect(actionsForCoin(coin)).toEqual(['transfer', 'deposit', 'withdraw']);
		}
	});

	/** sHBD stays transferable while earning, but cannot move in or out on a
	 *  rail of its own — offering Deposit there would dead-end the reader. */
	it('offers only transfer for sHBD', () => {
		expect(actionsForCoin(Coin.shbd.value)).toEqual(['transfer']);
	});

	it('offers nothing for staked, unstaking or unknown rows', () => {
		expect(actionsForCoin('hive_consensus')).toEqual([]);
		expect(actionsForCoin('consensus_unstaking')).toEqual([]);
		expect(actionsForCoin(undefined)).toEqual([]);
		expect(actionsForCoin('')).toEqual([]);
	});

	it('keeps a stable display order', () => {
		expect(ASSET_ACTIONS).toEqual(['transfer', 'deposit', 'withdraw']);
	});

	it('links to the matching wallet tab with the asset preselected', () => {
		expect(assetActionHref('deposit', Coin.hbd.value)).toBe('/deposit?coin=hbd');
		expect(assetActionHref('transfer', Coin.shbd.value)).toBe('/transfer?coin=hbd_savings');
		expect(assetActionHref('withdraw', Coin.btc.value)).toBe('/withdraw?coin=btc');
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
