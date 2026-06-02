/**
 * Tier-A integration test for the Hive Mainnet deposit flow.
 *
 * Mirrors what `DepositOptions.svelte` writes to txState when the user picks
 * "Hive Mainnet": from = HIVE-or-HBD on hiveMainnet, to = same coin on magi.
 *
 * Per docs.magi.eco, Hive↔Magi bridges via the Magi gateway account, not
 * Lightning — rail must derive to `magi`.
 */

import { describe, it, expect } from 'vitest';
import { DepositTxState } from '../utils/txState.svelte';
import { Coin, Network } from '../utils/sendOptions';
import { getIntermediaryNetwork } from '../utils/getNetwork';
import { getFee } from '../utils/sendUtils';
import { isValidAmountString } from '../../currency/CoinAmount';

function setupHiveMainnetDeposit(state: DepositTxState, coin: typeof Coin.hive | typeof Coin.hbd) {
	state.from = { coin, network: Network.hiveMainnet };
	state.to = { coin, network: Network.magi };
}

describe('Hive Mainnet deposit — flow integration', () => {
	it('HIVE: from = hive/hiveMainnet, to = hive/magi', () => {
		const state = new DepositTxState();
		setupHiveMainnetDeposit(state, Coin.hive);
		expect(state.from).toEqual({ coin: Coin.hive, network: Network.hiveMainnet });
		expect(state.to).toEqual({ coin: Coin.hive, network: Network.magi });
	});

	it('HBD: from = hbd/hiveMainnet, to = hbd/magi', () => {
		const state = new DepositTxState();
		setupHiveMainnetDeposit(state, Coin.hbd);
		expect(state.from).toEqual({ coin: Coin.hbd, network: Network.hiveMainnet });
		expect(state.to).toEqual({ coin: Coin.hbd, network: Network.magi });
	});

	it('rail derives to magi (Hive gateway path, not Lightning)', () => {
		const state = new DepositTxState();
		setupHiveMainnetDeposit(state, Coin.hive);
		expect(state.rail?.value).toBe(Network.magi.value);
	});

	it('derived rail matches direct getIntermediaryNetwork call', () => {
		const state = new DepositTxState();
		setupHiveMainnetDeposit(state, Coin.hbd);
		const direct = getIntermediaryNetwork(state.from!, state.to!);
		expect(state.rail?.value).toBe(direct.value);
	});

	it('amount validation', () => {
		expect(isValidAmountString('0')).toBe(false);
		expect(isValidAmountString('1.000')).toBe(true);
	});

	it('getFee resolves to 0 (Hive gateway, no Lightning fee)', async () => {
		const state = new DepositTxState();
		setupHiveMainnetDeposit(state, Coin.hive);
		state.toAmount = '1.000';
		const fee = await getFee(state.toAmount, state);
		expect(fee?.amount).toBe(0);
	});
});
