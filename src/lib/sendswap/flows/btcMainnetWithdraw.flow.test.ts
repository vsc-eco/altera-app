/**
 * Tier-A integration test for the BTC Mainnet withdraw flow.
 *
 * Mirrors what `WithdrawOptions.svelte` writes to txState when the user picks
 * "Bitcoin Mainnet", plus the BTC-specific fee fields (deductFee / maxFee) the
 * picker exposes. Then asserts the derived rail and what `getFee` resolves to
 * — i.e. exactly the values that flow into StepsMachine's broadcast call.
 *
 * Per docs.magi.eco, BTC mainnet swaps route through Magi (not Lightning), so
 * rail must derive to `magi` and getFee must resolve via magi.feeCalculation
 * (which returns 0).
 */

import { describe, it, expect } from 'vitest';
import { WithdrawTxState } from '../utils/txState.svelte';
import { Coin, Network } from '../utils/sendOptions';
import { getIntermediaryNetwork } from '../utils/getNetwork';
import { getFee } from '../utils/sendUtils';
import { isValidAmountString } from '../../currency/CoinAmount';

/** Mirrors the effect in WithdrawOptions.svelte when `btcMainnetOpen` flips true. */
function setupBtcMainnetWithdraw(state: WithdrawTxState) {
	state.from = { coin: Coin.btc, network: Network.magi };
	state.to = { coin: Coin.btc, network: Network.btcMainnet };
}

describe('BTC Mainnet withdraw — flow integration', () => {
	it('parent sets from = btc/magi, to = btc/btcMainnet', () => {
		const state = new WithdrawTxState();
		setupBtcMainnetWithdraw(state);
		expect(state.from).toEqual({ coin: Coin.btc, network: Network.magi });
		expect(state.to).toEqual({ coin: Coin.btc, network: Network.btcMainnet });
	});

	it('rail derives to magi (BTC bridge via DEX, not Lightning)', () => {
		const state = new WithdrawTxState();
		setupBtcMainnetWithdraw(state);
		expect(state.rail?.value).toBe(Network.magi.value);
	});

	it('derived rail matches direct getIntermediaryNetwork call', () => {
		const state = new WithdrawTxState();
		setupBtcMainnetWithdraw(state);
		const direct = getIntermediaryNetwork(state.from!, state.to!);
		expect(state.rail?.value).toBe(direct.value);
	});

	it('captures BTC-specific fee fields (deductFee, maxFee)', () => {
		const state = new WithdrawTxState();
		setupBtcMainnetWithdraw(state);
		expect(state.deductFee).toBe(false);
		expect(state.maxFee).toBeUndefined();

		state.deductFee = true;
		state.maxFee = 3000;
		expect(state.deductFee).toBe(true);
		expect(state.maxFee).toBe(3000);
	});

	it('amount validation: rejects 0, negatives, NaN; accepts a valid BTC amount', () => {
		expect(isValidAmountString('0')).toBe(false);
		expect(isValidAmountString('-0.001')).toBe(false);
		expect(isValidAmountString('NaN')).toBe(false);
		expect(isValidAmountString('0.0005')).toBe(true);
	});

	it('getFee resolves to 0 (magi DEX path, no Lightning gateway fee)', async () => {
		const state = new WithdrawTxState();
		setupBtcMainnetWithdraw(state);
		state.toAmount = '0.0005';
		const fee = await getFee(state.toAmount, state);
		expect(fee?.amount).toBe(0);
	});
});
