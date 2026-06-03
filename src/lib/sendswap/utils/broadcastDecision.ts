import { Network } from './sendOptions';
import type { CoinOnNetwork, IntermediaryNetwork } from './sendOptions';
import { getIntermediaryNetwork } from './getNetwork';
import type { TxState } from './txState.svelte';

export type TxType = 'swap' | 'transfer' | 'deposit' | 'withdraw';

/**
 * The three outcomes of deciding how to broadcast a transaction:
 *  - `error`: required fields are missing — bail with the given message
 *  - `v4v`: open the Lightning gateway popup and let it drive the broadcast
 *  - `send`: call `send()` with the computed intermediary network
 *
 * For deposit / withdraw flows where the user hasn't picked a destination,
 * `decideBroadcast` computes a default `to` (`defaultedTo`) but does NOT
 * apply it — the caller MUST write `defaultedTo` into `txState.to` before
 * acting on the decision, otherwise the broadcast picks up stale state.
 * Keeping the mutation out of `decideBroadcast` lets the function be a pure
 * value of its inputs (testable in isolation, no side effects).
 */
export type BroadcastDecision =
	| { action: 'error'; message: string }
	| { action: 'v4v'; defaultedTo?: CoinOnNetwork }
	| { action: 'send'; intermediary: IntermediaryNetwork; defaultedTo?: CoinOnNetwork };

/**
 * Pure decision logic extracted from `StepsMachine.initSend()`. Given a
 * tx-state (read-only) and the flow's `txType`, returns what action the
 * caller should take.
 *
 * Contract notes pinned by the test suite:
 *  - The intermediary is computed via `getIntermediaryNetwork(from, to)` —
 *    `txState.rail` / `txState.railOverride` are deliberately NOT read here.
 *    The override is a UI-filtering hint (consumed by `solveNetworkConstraints`),
 *    not a broadcast-routing override. Revisit if we ever want overrides to
 *    affect broadcast.
 *  - Lightning intermediary on a non-withdraw flow → opens the v4v popup
 *    (the popup itself drives the broadcast); withdraw flows broadcast
 *    directly even when the intermediary is Lightning (Keepsats).
 *  - Deposit/withdraw default-to: returns `defaultedTo` for the caller to
 *    apply to `txState.to`. The caller MUST apply it before broadcasting.
 */
export function decideBroadcast(txState: TxState, txType: TxType): BroadcastDecision {
	// Effective `to`: defaults to the txType's canonical network for
	// deposit/withdraw when the user hasn't picked a destination. We compute
	// this locally without writing to `txState` — the caller applies the
	// mutation when it dispatches on the decision.
	let effectiveTo: CoinOnNetwork | undefined = txState.to;
	let defaultedTo: CoinOnNetwork | undefined;
	if (!effectiveTo && txState.from) {
		const defaultToNetwork =
			txType === 'deposit'
				? Network.magi
				: txType === 'withdraw'
					? Network.hiveMainnet
					: undefined;
		if (defaultToNetwork) {
			defaultedTo = { coin: txState.from.coin, network: defaultToNetwork };
			effectiveTo = defaultedTo;
		}
	}

	if (!txState.from || !effectiveTo) {
		return { action: 'error', message: 'Required field undefined.' };
	}

	const intermediary = getIntermediaryNetwork(txState.from, effectiveTo);

	if (intermediary.value === Network.lightning.value && txType !== 'withdraw') {
		return { action: 'v4v', defaultedTo };
	}

	return { action: 'send', intermediary, defaultedTo };
}
