/**
 * Tier-A integration test for the Lightning deposit flow.
 *
 * Mirrors what `DepositOptions.svelte` writes to txState when the user picks
 * "Lightning". from.network is `lightning`, to.network is `magi`.
 *
 * Per docs.magi.eco, Lightning routes via the v4v gateway; rail must derive
 * to `lightning` (from.network triggers `throughLightning`). The gateway fee
 * is computed by `lightning.feeCalculation` which fetches v4v metadata —
 * stubbed here so the routing is exercised without a live network call.
 */

import { describe, it, expect } from 'vitest';
import { DepositTxState } from '../utils/txState.svelte';
import { Coin, Network, type AssetOption } from '../utils/sendOptions';
import { getIntermediaryNetwork } from '../utils/getNetwork';
import { isValidAmountString } from '../../currency/CoinAmount';

const SATS_ASSET: AssetOption = { coin: Coin.sats, networks: [Network.magi] };

/** Mirrors the effect in DepositOptions.svelte when `lightningOpen` flips true
 *  AND the user has nothing already selected — the "BTC in, SATS out" default. */
function setupLightningDeposit_btcToSats(state: DepositTxState) {
	state.from = { coin: Coin.btc, network: Network.lightning };
	state.to = { coin: SATS_ASSET.coin, network: Network.magi };
}

/** Variant where the user previously selected HIVE as the deposit target. */
function setupLightningDeposit_btcToHive(state: DepositTxState) {
	state.from = { coin: Coin.btc, network: Network.lightning };
	state.to = { coin: Coin.hive, network: Network.magi };
}

describe('Lightning deposit — flow integration', () => {
	it('default state: from = btc/lightning, to = sats/magi', () => {
		const state = new DepositTxState();
		setupLightningDeposit_btcToSats(state);
		expect(state.from).toEqual({ coin: Coin.btc, network: Network.lightning });
		expect(state.to).toEqual({ coin: Coin.sats, network: Network.magi });
	});

	it('rail derives to lightning whenever from.network is lightning', () => {
		const state = new DepositTxState();
		setupLightningDeposit_btcToSats(state);
		expect(state.rail?.value).toBe(Network.lightning.value);

		setupLightningDeposit_btcToHive(state);
		expect(state.rail?.value).toBe(Network.lightning.value);
	});

	it('derived rail matches direct getIntermediaryNetwork call', () => {
		const state = new DepositTxState();
		setupLightningDeposit_btcToSats(state);
		const direct = getIntermediaryNetwork(state.from!, state.to!);
		expect(state.rail?.value).toBe(direct.value);
		expect(direct.value).toBe(Network.lightning.value);
	});

	it('amount validation: rejects 0 and accepts a valid SATS amount', () => {
		expect(isValidAmountString('0')).toBe(false);
		expect(isValidAmountString('1000')).toBe(true); // 1000 sats minimum-ish
	});

	// Note: actual fee math via `getFee()` (which calls `lightning.feeCalculation`)
	// is covered by `reviewSwapFees.test.ts` / `v4v.test.ts` — those mock both
	// the v4v metadata fetch AND the CoinGecko prices fetch. We deliberately
	// skip it here to keep these flow tests fast and dependency-free.
});
