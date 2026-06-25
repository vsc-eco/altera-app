/**
 * Equivalence tests for the deposit-source txState initialization.
 *
 * The expectations below are hand-derived from the ORIGINAL effect
 * bodies in DepositOptions.svelte (pre-extraction, commit c6c529e era):
 * they pin the extracted functions to the legacy behavior so the new
 * DepositFlow picker provably initializes DepositTxState exactly like
 * the old menu did. Identical txState in → identical broadcast payload
 * out (the txState → decideBroadcast → sendUtils pipeline is pinned by
 * the existing flow tests in src/lib/sendswap/flows/).
 *
 * Each scenario states: starting txState (from/to) → expected from/to
 * after init.
 */
import { describe, expect, it } from 'vitest';
import { Coin, Network } from '../../utils/sendOptions';
import {
	initDepositStateForSource,
	initHiveMainnetDeposit,
	initLightningDeposit,
	type DepositInitState
} from './depositInit';

function state(
	from?: { coin: (typeof Coin)[keyof typeof Coin]; network: Network },
	to?: { coin: (typeof Coin)[keyof typeof Coin]; network: Network }
): DepositInitState {
	return { from, to };
}

// ─── Lightning ────────────────────────────────────────────────────────────────

describe('initLightningDeposit (legacy lightningOpen effect parity)', () => {
	it('empty state → BTC over Lightning in, SATS on Magi out (the defaults)', () => {
		const s = state();
		initLightningDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.btc.value);
		expect(s.from?.network.value).toBe(Network.lightning.value);
		expect(s.to?.coin.value).toBe(Coin.sats.value);
		expect(s.to?.network.value).toBe(Network.magi.value);
	});

	it('existing to=HIVE is preserved (receive HIVE via Lightning)', () => {
		const s = state(undefined, { coin: Coin.hive, network: Network.magi });
		initLightningDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.btc.value);
		expect(s.from?.network.value).toBe(Network.lightning.value);
		expect(s.to?.coin.value).toBe(Coin.hive.value);
		expect(s.to?.network.value).toBe(Network.magi.value);
	});

	it('existing to=HBD is preserved', () => {
		const s = state(undefined, { coin: Coin.hbd, network: Network.magi });
		initLightningDeposit(s);
		expect(s.to?.coin.value).toBe(Coin.hbd.value);
		expect(s.to?.network.value).toBe(Network.magi.value);
	});

	it('existing to=SATS resolves via the local satsCoin (not getToOption)', () => {
		const s = state(undefined, { coin: Coin.sats, network: Network.magi });
		initLightningDeposit(s);
		expect(s.to?.coin.value).toBe(Coin.sats.value);
		expect(s.to?.network.value).toBe(Network.magi.value);
	});

	it('to unset but from=HIVE → to maps to HIVE', () => {
		const s = state({ coin: Coin.hive, network: Network.hiveMainnet }, undefined);
		initLightningDeposit(s);
		expect(s.to?.coin.value).toBe(Coin.hive.value);
		// from gets replaced by the lightning-capable default (BTC) since
		// HIVE's from-option doesn't ride the Lightning network.
		expect(s.from?.coin.value).toBe(Coin.btc.value);
		expect(s.from?.network.value).toBe(Network.lightning.value);
	});

	it('lightning-capable from coin is preserved on the from side', () => {
		// BTC's from-option includes the Lightning network, so a BTC from
		// survives re-entry into the lightning path.
		const s = state({ coin: Coin.btc, network: Network.btcMainnet }, undefined);
		initLightningDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.btc.value);
		expect(s.from?.network.value).toBe(Network.lightning.value);
	});

	it('to=BTC (not hive/hbd/sats) falls back to the SATS default', () => {
		const s = state(undefined, { coin: Coin.btc, network: Network.magi });
		initLightningDeposit(s);
		expect(s.to?.coin.value).toBe(Coin.sats.value);
	});

	it('asset switch: a stale `from` does NOT override a newly-chosen `to` (lightning is to-first)', () => {
		// Contrast with the hiveMainnet CONFLICT case: lightning derives `to`
		// from txState.to FIRST, so an asset switch always follows the new asset
		// even with a stale `from` present. This is why the asset-switch bug was
		// Hive-Mainnet-specific — lightning (the only other multi-asset source)
		// was never affected, and pickAsset's `from` clear is a no-op for it
		// (the rail re-defaults to BTC/Lightning either way).
		const s = state(
			{ coin: Coin.btc, network: Network.lightning },
			{ coin: Coin.hbd, network: Network.magi }
		);
		initLightningDeposit(s);
		expect(s.to?.coin.value).toBe(Coin.hbd.value);
		expect(s.from?.coin.value).toBe(Coin.btc.value);
		expect(s.from?.network.value).toBe(Network.lightning.value);
	});
});

// ─── Hive Mainnet ─────────────────────────────────────────────────────────────

describe('initHiveMainnetDeposit (legacy hiveMainnetOpen effect parity)', () => {
	it('empty state → HIVE on hiveMainnet in, HIVE on Magi out (the defaults)', () => {
		const s = state();
		initHiveMainnetDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.hive.value);
		expect(s.from?.network.value).toBe(Network.hiveMainnet.value);
		expect(s.to?.coin.value).toBe(Coin.hive.value);
		expect(s.to?.network.value).toBe(Network.magi.value);
	});

	it('existing to=HBD → both sides become HBD', () => {
		const s = state(undefined, { coin: Coin.hbd, network: Network.magi });
		initHiveMainnetDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.hbd.value);
		expect(s.from?.network.value).toBe(Network.hiveMainnet.value);
		expect(s.to?.coin.value).toBe(Coin.hbd.value);
		expect(s.to?.network.value).toBe(Network.magi.value);
	});

	it('existing to=HIVE → both sides become HIVE', () => {
		const s = state(undefined, { coin: Coin.hive, network: Network.magi });
		initHiveMainnetDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.hive.value);
		expect(s.to?.coin.value).toBe(Coin.hive.value);
	});

	it('hiveMainnet-capable existing from coin is preserved', () => {
		// HBD's from-option includes hiveMainnet → an HBD from survives,
		// and the to side mirrors it.
		const s = state({ coin: Coin.hbd, network: Network.hiveMainnet }, undefined);
		initHiveMainnetDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.hbd.value);
		expect(s.to?.coin.value).toBe(Coin.hbd.value);
	});

	it('CONFLICT: a stale hiveMainnet `from` wins over a newly-chosen `to` — why pickAsset clears `from`', () => {
		// Reproduces the asset-switch bug: the user picks HIVE (from=HIVE),
		// then switches the asset to HBD (to=HBD) while Hive Mainnet stays
		// selected. Because HIVE is hiveMainnet-capable, init PRESERVES the
		// stale from AND reverts `to` back to it — so the Send step keeps HIVE.
		// This is exactly why DepositTimeline.pickAsset clears `from` before
		// re-init in the asset-first flow; the post-clear expectation is the
		// `existing to=HBD → both sides become HBD` test above.
		const s = state(
			{ coin: Coin.hive, network: Network.hiveMainnet },
			{ coin: Coin.hbd, network: Network.magi }
		);
		initHiveMainnetDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.hive.value);
		expect(s.to?.coin.value).toBe(Coin.hive.value);
	});

	it('non-hiveMainnet from (BTC) with no to → falls to the HIVE default', () => {
		const s = state({ coin: Coin.btc, network: Network.lightning }, undefined);
		initHiveMainnetDeposit(s);
		expect(s.from?.coin.value).toBe(Coin.hive.value);
		expect(s.to?.coin.value).toBe(Coin.hive.value);
	});

	it('from and to always share the same coin (deposit invariant)', () => {
		for (const to of [Coin.hive, Coin.hbd]) {
			const s = state(undefined, { coin: to, network: Network.magi });
			initHiveMainnetDeposit(s);
			expect(s.from?.coin.value).toBe(s.to?.coin.value);
		}
	});
});

// ─── Dispatch ─────────────────────────────────────────────────────────────────

describe('initDepositStateForSource', () => {
	it('routes lightning and hive_mainnet to their init', () => {
		const a = state();
		initDepositStateForSource(a, 'lightning');
		expect(a.from?.network.value).toBe(Network.lightning.value);

		const b = state();
		initDepositStateForSource(b, 'hive_mainnet');
		expect(b.from?.network.value).toBe(Network.hiveMainnet.value);
	});

	it('coinbase and btc_mainnet are no-ops (legacy parity — their components own inputs)', () => {
		for (const source of ['coinbase', 'btc_mainnet'] as const) {
			const s = state(
				{ coin: Coin.hive, network: Network.hiveMainnet },
				{ coin: Coin.hive, network: Network.magi }
			);
			const before = JSON.stringify({ f: s.from?.coin.value, t: s.to?.coin.value });
			initDepositStateForSource(s, source);
			expect(JSON.stringify({ f: s.from?.coin.value, t: s.to?.coin.value })).toBe(before);
		}
	});
});
