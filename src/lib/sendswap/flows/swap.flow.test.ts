/**
 * Tier-A integration test for cross-chain swap flows (QuickSwap + /swap page).
 *
 * Three representative cases:
 *  1. Internal magi swap (HIVE → HBD on magi) — both endpoints on Magi, simple
 *     HBD-paired DEX swap. Rail derives to magi.
 *  2. Cross-chain swap (BTC mainnet → HIVE hiveMainnet) — endpoints on
 *     different chains, but per docs.magi.eco this still routes through Magi
 *     (HBD-paired DEX), not Lightning. Rail derives to magi.
 *  3. The `railOverride` case — QuickSwap / /swap page force rail = lightning
 *     on Reown-BTC swaps as a UI hint even when the from/to-derived rail is
 *     magi. We verify the override behavior and the contract that clearing
 *     it restores the derived value.
 */

import { describe, it, expect } from 'vitest';
import { SwapTxState } from '../utils/txState.svelte';
import { Coin, Network } from '../utils/sendOptions';
import { getIntermediaryNetwork } from '../utils/getNetwork';

describe('Swap flows — flow integration', () => {
	describe('internal Magi swap (HIVE → HBD)', () => {
		function setup(state: SwapTxState) {
			state.from = { coin: Coin.hive, network: Network.magi };
			state.to = { coin: Coin.hbd, network: Network.magi };
		}

		it('rail derives to magi (HBD-paired DEX)', () => {
			const state = new SwapTxState();
			setup(state);
			expect(state.rail?.value).toBe(Network.magi.value);
		});

		it('matches direct getIntermediaryNetwork call', () => {
			const state = new SwapTxState();
			setup(state);
			expect(state.rail?.value).toBe(getIntermediaryNetwork(state.from!, state.to!).value);
		});
	});

	describe('cross-chain swap (BTC mainnet → HIVE hiveMainnet)', () => {
		function setup(state: SwapTxState) {
			state.from = { coin: Coin.btc, network: Network.btcMainnet };
			state.to = { coin: Coin.hive, network: Network.hiveMainnet };
		}

		it('rail derives to magi per docs (HBD-paired DEX, not Lightning)', () => {
			const state = new SwapTxState();
			setup(state);
			expect(state.rail?.value).toBe(Network.magi.value);
		});

		it('does NOT trigger the throughLightning branch', () => {
			const state = new SwapTxState();
			setup(state);
			const direct = getIntermediaryNetwork(state.from!, state.to!);
			expect(direct.value).not.toBe(Network.lightning.value);
		});
	});

	describe('railOverride contract (QuickSwap / /swap Reown case)', () => {
		it('railOverride wins when set; derivation restores when cleared', () => {
			const state = new SwapTxState();
			state.from = { coin: Coin.btc, network: Network.btcMainnet };
			state.to = { coin: Coin.hive, network: Network.hiveMainnet };
			expect(state.rail?.value).toBe(Network.magi.value);

			state.railOverride = Network.lightning;
			expect(state.rail?.value).toBe(Network.lightning.value);

			state.railOverride = undefined;
			expect(state.rail?.value).toBe(Network.magi.value);
		});

		it('override does NOT change from/to', () => {
			const state = new SwapTxState();
			state.from = { coin: Coin.btc, network: Network.btcMainnet };
			state.to = { coin: Coin.hive, network: Network.hiveMainnet };
			state.railOverride = Network.lightning;
			expect(state.from.network.value).toBe(Network.btcMainnet.value);
			expect(state.to.network.value).toBe(Network.hiveMainnet.value);
		});
	});

	describe('swap-specific fields', () => {
		it('SwapTxState defaults slippageBps to 100 and minAmountOut undefined', () => {
			const state = new SwapTxState();
			expect(state.slippageBps).toBe(100);
			expect(state.minAmountOut).toBeUndefined();
			expect(state.kind).toBe('swap');
		});

		it('expectedOutput and minAmountOut round-trip', () => {
			const state = new SwapTxState();
			state.expectedOutput = '4800';
			state.minAmountOut = '4750';
			expect(state.expectedOutput).toBe('4800');
			expect(state.minAmountOut).toBe('4750');
		});
	});
});
