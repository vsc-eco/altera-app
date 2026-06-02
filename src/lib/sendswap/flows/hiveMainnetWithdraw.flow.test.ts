/**
 * Tier-A integration test for the Hive Mainnet withdraw flow.
 *
 * Mirrors what `WithdrawOptions.svelte` writes to txState when the user picks
 * "Hive Mainnet": from = HIVE-or-HBD on magi, to = same coin on hiveMainnet.
 * The mirror of the Hive Mainnet deposit flow.
 */

import { describe, it, expect } from 'vitest';
import { WithdrawTxState } from '../utils/txState.svelte';
import { Coin, Network } from '../utils/sendOptions';
import { getIntermediaryNetwork } from '../utils/getNetwork';
import { getFee } from '../utils/sendUtils';

function setupHiveMainnetWithdraw(state: WithdrawTxState, coin: typeof Coin.hive | typeof Coin.hbd) {
	state.from = { coin, network: Network.magi };
	state.to = { coin, network: Network.hiveMainnet };
}

describe('Hive Mainnet withdraw — flow integration', () => {
	it('HIVE: from = hive/magi, to = hive/hiveMainnet', () => {
		const state = new WithdrawTxState();
		setupHiveMainnetWithdraw(state, Coin.hive);
		expect(state.from).toEqual({ coin: Coin.hive, network: Network.magi });
		expect(state.to).toEqual({ coin: Coin.hive, network: Network.hiveMainnet });
	});

	it('HBD: from = hbd/magi, to = hbd/hiveMainnet', () => {
		const state = new WithdrawTxState();
		setupHiveMainnetWithdraw(state, Coin.hbd);
		expect(state.from).toEqual({ coin: Coin.hbd, network: Network.magi });
		expect(state.to).toEqual({ coin: Coin.hbd, network: Network.hiveMainnet });
	});

	it('rail derives to magi (Hive gateway path)', () => {
		const state = new WithdrawTxState();
		setupHiveMainnetWithdraw(state, Coin.hive);
		expect(state.rail?.value).toBe(Network.magi.value);
	});

	it('derived rail matches direct getIntermediaryNetwork call', () => {
		const state = new WithdrawTxState();
		setupHiveMainnetWithdraw(state, Coin.hbd);
		const direct = getIntermediaryNetwork(state.from!, state.to!);
		expect(state.rail?.value).toBe(direct.value);
	});

	it('BTC-mainnet fee fields stay at defaults (not used for Hive withdraw)', () => {
		const state = new WithdrawTxState();
		setupHiveMainnetWithdraw(state, Coin.hive);
		expect(state.deductFee).toBe(false);
		expect(state.maxFee).toBeUndefined();
	});

	it('getFee resolves to 0', async () => {
		const state = new WithdrawTxState();
		setupHiveMainnetWithdraw(state, Coin.hive);
		state.toAmount = '1.000';
		const fee = await getFee(state.toAmount, state);
		expect(fee?.amount).toBe(0);
	});
});
