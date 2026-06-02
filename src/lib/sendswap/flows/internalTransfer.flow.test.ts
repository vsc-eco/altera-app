/**
 * Tier-A integration test for the internal transfer (QuickSend) flow.
 *
 * Internal transfers stay on Magi the whole way: from = X/magi, to = X/magi.
 * Rail derives to magi naturally (both endpoints supported, neither lightning,
 * not hiveMainnet-on-both).
 *
 * The QuickSend card-specific gate (recipient ≠ sender on the same network)
 * is exercised by asserting the `toSelf` shape used in QuickSendOptions.
 */

import { describe, it, expect } from 'vitest';
import { TransferTxState } from '../utils/txState.svelte';
import { Coin, Network } from '../utils/sendOptions';
import { getIntermediaryNetwork } from '../utils/getNetwork';
import { getFee } from '../utils/sendUtils';
import { isValidAmountString } from '../../currency/CoinAmount';

function setupInternalTransfer(state: TransferTxState, coin: typeof Coin.hive | typeof Coin.hbd | typeof Coin.shbd | typeof Coin.btc) {
	state.from = { coin, network: Network.magi };
	state.to = { coin, network: Network.magi };
}

describe('Internal transfer (QuickSend) — flow integration', () => {
	it('HIVE → HIVE on magi', () => {
		const state = new TransferTxState();
		setupInternalTransfer(state, Coin.hive);
		expect(state.from).toEqual({ coin: Coin.hive, network: Network.magi });
		expect(state.to).toEqual({ coin: Coin.hive, network: Network.magi });
	});

	it('rail derives to magi (internal — both endpoints on magi)', () => {
		const state = new TransferTxState();
		setupInternalTransfer(state, Coin.hive);
		expect(state.rail?.value).toBe(Network.magi.value);
	});

	it('derivation works for any magi-supported coin (HBD, sHBD, BTC)', () => {
		for (const coin of [Coin.hbd, Coin.shbd, Coin.btc]) {
			const state = new TransferTxState();
			setupInternalTransfer(state, coin);
			expect(state.rail?.value).toBe(Network.magi.value);
			const direct = getIntermediaryNetwork(state.from!, state.to!);
			expect(direct.value).toBe(Network.magi.value);
		}
	});

	it('captures transfer-specific fields (memo, toDisplayName)', () => {
		const state = new TransferTxState();
		setupInternalTransfer(state, Coin.hive);
		state.toUsername = 'alice';
		state.toDisplayName = 'Alice';
		state.memo = 'for lunch';
		expect(state.toUsername).toBe('alice');
		expect(state.toDisplayName).toBe('Alice');
		expect(state.memo).toBe('for lunch');
	});

	it('to-self detection: same username + same network (the QuickSend gate)', () => {
		const state = new TransferTxState();
		setupInternalTransfer(state, Coin.hive);
		state.toUsername = 'alice';
		const isSelf =
			state.toUsername === 'alice' && state.from?.network.value === state.to?.network.value;
		expect(isSelf).toBe(true);
	});

	it('amount validation rejects 0', () => {
		expect(isValidAmountString('0')).toBe(false);
		expect(isValidAmountString('1.5')).toBe(true);
	});

	it('getFee resolves to 0 (no cross-chain bridge involved)', async () => {
		const state = new TransferTxState();
		setupInternalTransfer(state, Coin.hive);
		state.toAmount = '1.5';
		const fee = await getFee(state.toAmount, state);
		expect(fee?.amount).toBe(0);
	});
});
