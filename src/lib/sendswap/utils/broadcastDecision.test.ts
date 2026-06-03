/**
 * Tier-C test for the broadcast decision logic extracted from StepsMachine.
 *
 * Each test pins what `send()` would be invoked with (or whether the v4v
 * popup opens, or whether we bail with an error) for a given (txState, txType)
 * combination. These are the contracts that every transaction flow must
 * satisfy at broadcast time — a migration regression here ships a swap to
 * the wrong rail.
 */

import { describe, it, expect } from 'vitest';
import { decideBroadcast } from './broadcastDecision';
import {
	SwapTxState,
	TransferTxState,
	DepositTxState,
	WithdrawTxState
} from './txState.svelte';
import { Coin, Network } from './sendOptions';

// ─── Error cases ─────────────────────────────────────────────────────────────

describe('decideBroadcast — error cases', () => {
	it('returns error when both from and to are unset (transfer)', () => {
		const state = new TransferTxState();
		const d = decideBroadcast(state, 'transfer');
		expect(d).toEqual({ action: 'error', message: 'Required field undefined.' });
	});

	it('returns error when from is unset (swap — no auto-default for swap)', () => {
		const state = new SwapTxState();
		state.to = { coin: Coin.hbd, network: Network.magi };
		const d = decideBroadcast(state, 'swap');
		expect(d.action).toBe('error');
	});
});

// ─── Default-to logic for deposit/withdraw ───────────────────────────────────

describe('decideBroadcast — default-to logic (pure: returns defaultedTo, caller applies)', () => {
	it('deposit with from set but to undefined → returns defaultedTo with network = magi (does NOT mutate state)', () => {
		const state = new DepositTxState();
		state.from = { coin: Coin.hive, network: Network.hiveMainnet };
		const d = decideBroadcast(state, 'deposit');
		// Function is now pure — txState is unchanged after the call.
		expect(state.to).toBeUndefined();
		expect(d.action).toBe('send');
		// The defaulted value is returned for the caller to apply.
		expect(d.action !== 'error' && d.defaultedTo).toEqual({
			coin: Coin.hive,
			network: Network.magi
		});
	});

	it('withdraw with from set but to undefined → returns defaultedTo with network = hiveMainnet (no mutation)', () => {
		const state = new WithdrawTxState();
		state.from = { coin: Coin.hive, network: Network.magi };
		const d = decideBroadcast(state, 'withdraw');
		expect(state.to).toBeUndefined();
		expect(d.action).toBe('send');
		expect(d.action !== 'error' && d.defaultedTo).toEqual({
			coin: Coin.hive,
			network: Network.hiveMainnet
		});
	});

	it('swap with from set but to undefined → error (no auto-default for swap)', () => {
		const state = new SwapTxState();
		state.from = { coin: Coin.hive, network: Network.magi };
		const d = decideBroadcast(state, 'swap');
		expect(state.to).toBeUndefined();
		expect(d.action).toBe('error');
	});

	it('transfer with from set but to undefined → error (no auto-default for transfer)', () => {
		const state = new TransferTxState();
		state.from = { coin: Coin.hive, network: Network.magi };
		const d = decideBroadcast(state, 'transfer');
		expect(state.to).toBeUndefined();
		expect(d.action).toBe('error');
	});
});

// ─── Broadcast intermediary by flow ──────────────────────────────────────────

describe('decideBroadcast — broadcast intermediary per flow', () => {
	it('internal transfer (HIVE magi→magi) → send via magi', () => {
		const state = new TransferTxState();
		state.from = { coin: Coin.hive, network: Network.magi };
		state.to = { coin: Coin.hive, network: Network.magi };
		expect(decideBroadcast(state, 'transfer')).toEqual({
			action: 'send',
			intermediary: Network.magi
		});
	});

	it('internal swap (HIVE→HBD on magi) → send via magi', () => {
		const state = new SwapTxState();
		state.from = { coin: Coin.hive, network: Network.magi };
		state.to = { coin: Coin.hbd, network: Network.magi };
		expect(decideBroadcast(state, 'swap')).toEqual({
			action: 'send',
			intermediary: Network.magi
		});
	});

	it('cross-chain swap (BTC mainnet → HIVE hiveMainnet) → send via magi (per docs.magi.eco)', () => {
		const state = new SwapTxState();
		state.from = { coin: Coin.btc, network: Network.btcMainnet };
		state.to = { coin: Coin.hive, network: Network.hiveMainnet };
		const d = decideBroadcast(state, 'swap');
		expect(d).toEqual({ action: 'send', intermediary: Network.magi });
	});

	it('Hive Mainnet deposit (hiveMainnet → magi) → send via magi', () => {
		const state = new DepositTxState();
		state.from = { coin: Coin.hive, network: Network.hiveMainnet };
		state.to = { coin: Coin.hive, network: Network.magi };
		expect(decideBroadcast(state, 'deposit')).toEqual({
			action: 'send',
			intermediary: Network.magi
		});
	});

	it('Hive Mainnet withdraw (magi → hiveMainnet) → send via magi', () => {
		const state = new WithdrawTxState();
		state.from = { coin: Coin.hive, network: Network.magi };
		state.to = { coin: Coin.hive, network: Network.hiveMainnet };
		expect(decideBroadcast(state, 'withdraw')).toEqual({
			action: 'send',
			intermediary: Network.magi
		});
	});

	it('BTC Mainnet withdraw (magi → btcMainnet) → send via magi', () => {
		const state = new WithdrawTxState();
		state.from = { coin: Coin.btc, network: Network.magi };
		state.to = { coin: Coin.btc, network: Network.btcMainnet };
		expect(decideBroadcast(state, 'withdraw')).toEqual({
			action: 'send',
			intermediary: Network.magi
		});
	});

	it('Keepsats withdraw (magi → lightning) → send via lightning (withdraw bypasses v4v popup)', () => {
		// Lightning withdraw is the one case where intermediary === lightning but
		// the v4v popup is NOT opened — `send()` handles the lightning broadcast
		// directly. The popup is only for deposits / swaps going IN to lightning.
		const state = new WithdrawTxState();
		state.from = { coin: Coin.btc, network: Network.magi };
		state.to = { coin: Coin.btc, network: Network.lightning };
		const d = decideBroadcast(state, 'withdraw');
		expect(d).toEqual({ action: 'send', intermediary: Network.lightning });
	});
});

// ─── V4V popup branch ────────────────────────────────────────────────────────

describe('decideBroadcast — v4v popup branch', () => {
	it('Lightning deposit (from.network = lightning) → v4v on deposit', () => {
		const state = new DepositTxState();
		state.from = { coin: Coin.btc, network: Network.lightning };
		state.to = { coin: Coin.hive, network: Network.magi };
		expect(decideBroadcast(state, 'deposit')).toEqual({ action: 'v4v' });
	});

	it('Lightning-routed swap (from.network = lightning) → v4v on swap', () => {
		const state = new SwapTxState();
		state.from = { coin: Coin.btc, network: Network.lightning };
		state.to = { coin: Coin.hive, network: Network.magi };
		expect(decideBroadcast(state, 'swap')).toEqual({ action: 'v4v' });
	});

	it('Lightning-routed transfer (to.network = lightning) → v4v on transfer', () => {
		const state = new TransferTxState();
		state.from = { coin: Coin.btc, network: Network.magi };
		state.to = { coin: Coin.btc, network: Network.lightning };
		expect(decideBroadcast(state, 'transfer')).toEqual({ action: 'v4v' });
	});
});

// ─── railOverride is NOT read (contract pinning) ─────────────────────────────

describe('decideBroadcast — railOverride is deliberately NOT read', () => {
	// Pins the current contract: railOverride affects only `solveNetworkConstraints`
	// (UI filtering), not the broadcast intermediary. If we ever decide to wire
	// railOverride into broadcast routing, these tests invert in one line and
	// document the behavior change.

	it('railOverride = lightning on a BTC mainnet → HIVE swap is IGNORED — intermediary stays magi', () => {
		const state = new SwapTxState();
		state.from = { coin: Coin.btc, network: Network.btcMainnet };
		state.to = { coin: Coin.hive, network: Network.hiveMainnet };
		state.railOverride = Network.lightning;
		const d = decideBroadcast(state, 'swap');
		// Even with override = lightning, decideBroadcast picks magi from the
		// from/to networks. Documents the rail-read decision deferred earlier.
		expect(d).toEqual({ action: 'send', intermediary: Network.magi });
	});

	it('railOverride = magi on a Lightning deposit does NOT prevent the v4v popup', () => {
		const state = new DepositTxState();
		state.from = { coin: Coin.btc, network: Network.lightning };
		state.to = { coin: Coin.hive, network: Network.magi };
		state.railOverride = Network.magi;
		expect(decideBroadcast(state, 'deposit')).toEqual({ action: 'v4v' });
	});
});
