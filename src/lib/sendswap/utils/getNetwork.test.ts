/**
 * Tests for getIntermediaryNetwork and settlementLabel.
 *
 * getIntermediaryNetwork is about to become load-bearing: Milo's review on the
 * txState refactor wants `rail` to derive from this function rather than be
 * set explicitly. Locking in current behavior now means we can change how
 * rail is wired without silently changing routing.
 *
 * settlementLabel feeds the user-visible ETA in ReviewSwap.
 */

import { describe, it, expect } from 'vitest';
import { getIntermediaryNetwork, settlementLabel } from './getNetwork';
import { Coin, Network, type CoinOnNetwork } from './sendOptions';

const on = (coin: Coin, network: Network): CoinOnNetwork => ({ coin, network });

// ─── getIntermediaryNetwork ──────────────────────────────────────────────────

describe('getIntermediaryNetwork — routing rules', () => {
	it('magi → magi (internal transfer) routes via magi', () => {
		const result = getIntermediaryNetwork(on(Coin.hive, Network.magi), on(Coin.hive, Network.magi));
		expect(result.value).toBe(Network.magi.value);
	});

	it('magi → hiveMainnet (HIVE withdraw) routes via magi', () => {
		const result = getIntermediaryNetwork(
			on(Coin.hive, Network.magi),
			on(Coin.hive, Network.hiveMainnet)
		);
		expect(result.value).toBe(Network.magi.value);
	});

	it('hiveMainnet → magi (HIVE deposit) routes via magi', () => {
		const result = getIntermediaryNetwork(
			on(Coin.hive, Network.hiveMainnet),
			on(Coin.hive, Network.magi)
		);
		expect(result.value).toBe(Network.magi.value);
	});

	it('magi → btcMainnet (BTC withdraw) routes via magi', () => {
		const result = getIntermediaryNetwork(
			on(Coin.btc, Network.magi),
			on(Coin.btc, Network.btcMainnet)
		);
		expect(result.value).toBe(Network.magi.value);
	});

	it('btcMainnet → magi (BTC mainnet deposit) routes via magi', () => {
		const result = getIntermediaryNetwork(
			on(Coin.btc, Network.btcMainnet),
			on(Coin.btc, Network.magi)
		);
		expect(result.value).toBe(Network.magi.value);
	});

	it('hiveMainnet → hiveMainnet routes via hiveMainnet (not magi)', () => {
		// This is the only pair that bypasses magi.
		const result = getIntermediaryNetwork(
			on(Coin.hive, Network.hiveMainnet),
			on(Coin.hbd, Network.hiveMainnet)
		);
		expect(result.value).toBe(Network.hiveMainnet.value);
	});

	it('lightning on from → routes via lightning (BTC mainnet deposit via LN)', () => {
		const result = getIntermediaryNetwork(
			on(Coin.btc, Network.lightning),
			on(Coin.hive, Network.magi)
		);
		expect(result.value).toBe(Network.lightning.value);
	});

	it('lightning on to → routes via lightning (Keepsats-style withdraw)', () => {
		const result = getIntermediaryNetwork(
			on(Coin.btc, Network.magi),
			on(Coin.btc, Network.lightning)
		);
		expect(result.value).toBe(Network.lightning.value);
	});

	it('lightning takes precedence over hive-direct routing', () => {
		// Both endpoints touch lightning; should not fall through to hive.
		const result = getIntermediaryNetwork(
			on(Coin.btc, Network.lightning),
			on(Coin.btc, Network.lightning)
		);
		expect(result.value).toBe(Network.lightning.value);
	});

	it('unknown network pair falls back to Network.unknown', () => {
		const bogus: Network = {
			value: 'totally_made_up',
			label: 'Made Up',
			icon: '/x.svg',
			settlementSeconds: 0
		};
		const result = getIntermediaryNetwork(on(Coin.hive, bogus), on(Coin.hive, Network.magi));
		expect(result.value).toBe(Network.unknown.value);
	});

	it('the returned IntermediaryNetwork exposes a feeCalculation function', () => {
		// `IntermediaryNetwork = Network & { feeCalculation: ... }` — required
		// non-null at the type level. Sanity-check the runtime contract.
		const result = getIntermediaryNetwork(on(Coin.hive, Network.magi), on(Coin.hive, Network.magi));
		expect(typeof result.feeCalculation).toBe('function');
	});
});

// ─── settlementLabel ─────────────────────────────────────────────────────────

describe('settlementLabel — user-visible ETA', () => {
	it('empty list returns empty string', () => {
		expect(settlementLabel([])).toBe('');
	});

	it('all-undefined returns empty string', () => {
		expect(settlementLabel([undefined, undefined])).toBe('');
	});

	it('magi alone (0s) is Instant', () => {
		expect(settlementLabel([Network.magi])).toBe('Instant');
	});

	it('hiveMainnet alone (~3s) is Instant', () => {
		expect(settlementLabel([Network.hiveMainnet])).toBe('Instant');
	});

	it('lightning alone (~60s) is "About a minute"', () => {
		expect(settlementLabel([Network.lightning])).toBe('About a minute');
	});

	it('btcMainnet alone (~600s) is "About 10 minutes"', () => {
		expect(settlementLabel([Network.btcMainnet])).toBe('About 10 minutes');
	});

	it('picks the slowest network when several are passed', () => {
		expect(
			settlementLabel([Network.magi, Network.lightning, Network.btcMainnet, Network.hiveMainnet])
		).toBe('About 10 minutes');
	});

	it('skips undefined entries (e.g. unset rail)', () => {
		expect(settlementLabel([Network.lightning, undefined, Network.magi])).toBe('About a minute');
	});
});
