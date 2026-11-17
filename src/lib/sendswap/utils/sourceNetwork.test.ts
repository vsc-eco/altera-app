import { describe, expect, it } from 'vitest';
import { Coin, Network, isSelectableSource, resolveSourceNetwork } from './sendOptions';

describe('isSelectableSource', () => {
	it('accepts the networks each coin really lives on', () => {
		expect(isSelectableSource(Coin.hive.value, Network.magi.value)).toBe(true);
		expect(isSelectableSource(Coin.hive.value, Network.hiveMainnet.value)).toBe(true);
		expect(isSelectableSource(Coin.btc.value, Network.btcMainnet.value)).toBe(true);
		expect(isSelectableSource(Coin.btc.value, Network.magi.value)).toBe(true);
		expect(isSelectableSource(Coin.shbd.value, Network.magi.value)).toBe(true);
	});

	/** H1: the flip produced exactly this pair, and the "swap" then signed a
	 *  plain BTC transfer because send() could not classify it. */
	it('rejects a coin on a network it cannot be on', () => {
		expect(isSelectableSource(Coin.hive.value, Network.btcMainnet.value)).toBe(false);
		expect(isSelectableSource(Coin.hbd.value, Network.btcMainnet.value)).toBe(false);
		expect(isSelectableSource(Coin.btc.value, Network.hiveMainnet.value)).toBe(false);
		expect(isSelectableSource(Coin.shbd.value, Network.hiveMainnet.value)).toBe(false);
	});

	/** The source step never offers Lightning, so a source on it is the same
	 *  class of impossible state. */
	it('rejects Lightning as a source', () => {
		expect(isSelectableSource(Coin.btc.value, Network.lightning.value)).toBe(false);
	});

	it('treats coins outside the from-list as Magi-only', () => {
		expect(isSelectableSource('LASSECASH', Network.magi.value)).toBe(true);
		expect(isSelectableSource('LASSECASH', Network.hiveMainnet.value)).toBe(false);
		expect(isSelectableSource(Coin.sats.value, Network.magi.value)).toBe(true);
	});

	it('rejects missing parts rather than guessing', () => {
		expect(isSelectableSource(undefined, Network.magi.value)).toBe(false);
		expect(isSelectableSource(Coin.hive.value, undefined)).toBe(false);
	});
});

describe('resolveSourceNetwork', () => {
	it('keeps the preferred network when the coin can be there', () => {
		expect(resolveSourceNetwork(Coin.hive.value, Network.hiveMainnet.value).value).toBe(
			Network.hiveMainnet.value
		);
		expect(resolveSourceNetwork(Coin.btc.value, Network.btcMainnet.value).value).toBe(
			Network.btcMainnet.value
		);
	});

	/** The flip case: BTC/Bitcoin flipped to HIVE must not keep Bitcoin. */
	it('falls back to the coin own first network when the preferred one is impossible', () => {
		expect(resolveSourceNetwork(Coin.hive.value, Network.btcMainnet.value).value).toBe(
			Network.magi.value
		);
		expect(resolveSourceNetwork(Coin.btc.value, Network.hiveMainnet.value).value).toBe(
			Network.magi.value
		);
	});

	it('never returns Lightning', () => {
		expect(resolveSourceNetwork(Coin.btc.value, Network.lightning.value).value).not.toBe(
			Network.lightning.value
		);
	});

	it('puts coins outside the from-list on Magi', () => {
		expect(resolveSourceNetwork('LASSECASH', Network.hiveMainnet.value).value).toBe(
			Network.magi.value
		);
	});
});
