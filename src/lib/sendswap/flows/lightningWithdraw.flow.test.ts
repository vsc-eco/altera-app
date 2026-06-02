/**
 * Tier-A integration test for the Lightning (Keepsats) withdraw flow.
 *
 * Mirrors what `WithdrawOptions.svelte` writes to txState when the user picks
 * "Lightning Transfer" (Keepsats): from = btc/magi, to = btc/lightning. The
 * rail derives to `lightning` because to.network is Lightning.
 *
 * The picker also allows the user to flip the display between BTC and SATS;
 * that's a presentation concern (handled in `KeepsatsWithdraw.svelte`) and
 * doesn't change the underlying tx state shape.
 */

import { describe, it, expect } from 'vitest';
import { WithdrawTxState } from '../utils/txState.svelte';
import { Coin, Network } from '../utils/sendOptions';
import { getIntermediaryNetwork } from '../utils/getNetwork';
import { isValidAmountString } from '../../currency/CoinAmount';

/** Mirrors the effect in WithdrawOptions.svelte when `lightningTransferOpen` flips true. */
function setupLightningWithdraw(state: WithdrawTxState) {
	state.from = { coin: Coin.btc, network: Network.magi };
	state.to = { coin: Coin.btc, network: Network.lightning };
}

describe('Lightning (Keepsats) withdraw — flow integration', () => {
	it('parent sets from = btc/magi, to = btc/lightning', () => {
		const state = new WithdrawTxState();
		setupLightningWithdraw(state);
		expect(state.from).toEqual({ coin: Coin.btc, network: Network.magi });
		expect(state.to).toEqual({ coin: Coin.btc, network: Network.lightning });
	});

	it('rail derives to lightning (to.network triggers throughLightning)', () => {
		const state = new WithdrawTxState();
		setupLightningWithdraw(state);
		expect(state.rail?.value).toBe(Network.lightning.value);
	});

	it('derived rail matches direct getIntermediaryNetwork call', () => {
		const state = new WithdrawTxState();
		setupLightningWithdraw(state);
		const direct = getIntermediaryNetwork(state.from!, state.to!);
		expect(state.rail?.value).toBe(direct.value);
	});

	it('does NOT carry deductFee/maxFee semantics like BTC mainnet does', () => {
		// Lightning withdraw is settled by the v4v gateway, not the BTC unmap
		// contract — the BTC-mainnet fee controls don't apply. The fields exist
		// on WithdrawTxState but should stay at defaults for this flow.
		const state = new WithdrawTxState();
		setupLightningWithdraw(state);
		expect(state.deductFee).toBe(false);
		expect(state.maxFee).toBeUndefined();
	});

	it('amount validation: same gate as other withdraws', () => {
		expect(isValidAmountString('0')).toBe(false);
		expect(isValidAmountString('')).toBe(false);
		expect(isValidAmountString('500')).toBe(true);
	});

	// Note: actual fee math via `getFee()` (which calls `lightning.feeCalculation`)
	// is covered by `reviewSwapFees.test.ts` / `v4v.test.ts` — those mock both
	// the v4v metadata fetch AND the CoinGecko prices fetch. We deliberately
	// skip it here to keep these flow tests fast and dependency-free.
});
