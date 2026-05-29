/**
 * Tests for the swapOptions catalog lookups.
 *
 * getFromOption / getToOption replaced ~20 ad-hoc `.find()` calls scattered
 * across send/swap stages. The catalog has asymmetric coverage by design:
 * SATS, USD and UNK are not in either list, and sHBD is in `.from` only.
 * That asymmetry caused a real bug during the from/to migration: the
 * Lightning deposit branch in DepositOptions had to add an explicit SATS
 * fallback because `getToOption('sats')` returned undefined.
 *
 * These tests pin that asymmetry so future contributors don't silently
 * introduce a regression that hides SATS in deposits.
 */

import { describe, it, expect } from 'vitest';
import swapOptions, { Coin, Network, getFromOption, getToOption } from './sendOptions';

// ─── getFromOption ───────────────────────────────────────────────────────────

describe('getFromOption — source asset catalog', () => {
	it('returns the AssetOption for HIVE', () => {
		const opt = getFromOption(Coin.hive.value);
		expect(opt?.coin.value).toBe(Coin.hive.value);
		expect(opt?.networks.map((n) => n.value)).toEqual([
			Network.magi.value,
			Network.hiveMainnet.value
		]);
	});

	it('returns the AssetOption for HBD', () => {
		const opt = getFromOption(Coin.hbd.value);
		expect(opt?.coin.value).toBe(Coin.hbd.value);
		expect(opt?.networks.map((n) => n.value)).toContain(Network.hiveMainnet.value);
	});

	it('returns the AssetOption for sHBD (magi-only)', () => {
		const opt = getFromOption(Coin.shbd.value);
		expect(opt?.coin.value).toBe(Coin.shbd.value);
		expect(opt?.networks.map((n) => n.value)).toEqual([Network.magi.value]);
	});

	it('returns the AssetOption for BTC', () => {
		const opt = getFromOption(Coin.btc.value);
		expect(opt?.coin.value).toBe(Coin.btc.value);
		expect(opt?.networks.map((n) => n.value)).toEqual([
			Network.magi.value,
			Network.btcMainnet.value
		]);
	});

	it('returns undefined for SATS (deliberately absent from the catalog)', () => {
		// SATS is a display denomination of BTC, not a source asset on its own.
		// Callers must fall back to an explicit { coin: sats, networks: [magi] }
		// (see DepositOptions Lightning branch).
		expect(getFromOption(Coin.sats.value)).toBeUndefined();
	});

	it('returns undefined for USD (display-only)', () => {
		expect(getFromOption(Coin.usd.value)).toBeUndefined();
	});

	it('returns undefined for UNK (placeholder)', () => {
		expect(getFromOption(Coin.unk.value)).toBeUndefined();
	});

	it('returns undefined for unknown coin values', () => {
		expect(getFromOption('doge')).toBeUndefined();
		expect(getFromOption('')).toBeUndefined();
		expect(getFromOption(undefined)).toBeUndefined();
	});
});

// ─── getToOption ─────────────────────────────────────────────────────────────

describe('getToOption — destination asset catalog', () => {
	it('returns the AssetOption for HIVE', () => {
		const opt = getToOption(Coin.hive.value);
		expect(opt?.coin.value).toBe(Coin.hive.value);
		expect(opt?.networks.map((n) => n.value)).toContain(Network.magi.value);
	});

	it('returns the AssetOption for HBD', () => {
		const opt = getToOption(Coin.hbd.value);
		expect(opt?.coin.value).toBe(Coin.hbd.value);
	});

	it('returns the AssetOption for BTC (with btcMainnet first)', () => {
		const opt = getToOption(Coin.btc.value);
		expect(opt?.coin.value).toBe(Coin.btc.value);
		// `to` lists btc with btcMainnet ahead of magi — the default toNetwork
		// for a BTC withdraw is mainnet, not magi. Keep this ordering pinned.
		expect(opt?.networks[0].value).toBe(Network.btcMainnet.value);
	});

	it('returns undefined for sHBD (deliberately not in destinations)', () => {
		// sHBD cannot be a destination on its own — TransferOptions uses this
		// asymmetry to block transfers TO sHBD.
		expect(getToOption(Coin.shbd.value)).toBeUndefined();
	});

	it('returns undefined for SATS (not in catalog)', () => {
		expect(getToOption(Coin.sats.value)).toBeUndefined();
	});

	it('returns undefined for USD / UNK / unknown', () => {
		expect(getToOption(Coin.usd.value)).toBeUndefined();
		expect(getToOption(Coin.unk.value)).toBeUndefined();
		expect(getToOption('doge')).toBeUndefined();
		expect(getToOption(undefined)).toBeUndefined();
	});
});

// ─── swapOptions invariants ──────────────────────────────────────────────────

describe('swapOptions catalog invariants', () => {
	it('every from-AssetOption has at least one network', () => {
		for (const opt of swapOptions.from) {
			expect(opt.networks.length).toBeGreaterThan(0);
		}
	});

	it('every to-AssetOption has at least one network', () => {
		for (const opt of swapOptions.to) {
			expect(opt.networks.length).toBeGreaterThan(0);
		}
	});

	it('from-AssetOptions list magi as the first network where applicable', () => {
		// txState shims default `network` to `v.networks[0]` when the AssetOption
		// is assigned to fromCoin/toCoin while `from`/`to` is undefined. Many
		// effects rely on this defaulting to magi — pin it.
		for (const opt of swapOptions.from) {
			expect(opt.networks[0].value).toBe(Network.magi.value);
		}
	});
});
