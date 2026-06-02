import { Network } from './sendOptions';
import type { IntermediaryNetwork } from './sendOptions';
import { getIntermediaryNetwork } from './getNetwork';
import type { TxState } from './txState.svelte';

export type TxType = 'swap' | 'transfer' | 'deposit' | 'withdraw';

/**
 * The three outcomes of deciding how to broadcast a transaction:
 *  - `error`: required fields are missing — bail with the given message
 *  - `v4v`: open the Lightning gateway popup and let it drive the broadcast
 *  - `send`: call `send()` with the computed intermediary network
 */
export type BroadcastDecision =
	| { action: 'error'; message: string }
	| { action: 'v4v' }
	| { action: 'send'; intermediary: IntermediaryNetwork };

/**
 * Pure decision logic extracted from `StepsMachine.initSend()`. Given a
 * tx-state and the flow's `txType`, returns what action the caller should
 * take. The function MUTATES `txState.to` when applying the default-to
 * logic for deposit/withdraw (matches the in-place behavior the component
 * had before extraction).
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
 */
export function decideBroadcast(txState: TxState, txType: TxType): BroadcastDecision {
	// For deposit/withdraw: when the user hasn't picked a destination, default
	// `to` to the same coin as `from` on the txType's canonical network.
	if (!txState.to && txState.from) {
		const defaultToNetwork =
			txType === 'deposit'
				? Network.magi
				: txType === 'withdraw'
					? Network.hiveMainnet
					: undefined;
		if (defaultToNetwork) {
			txState.to = { coin: txState.from.coin, network: defaultToNetwork };
		}
	}

	if (!txState.from || !txState.to) {
		return { action: 'error', message: 'Required field undefined.' };
	}

	const intermediary = getIntermediaryNetwork(txState.from, txState.to);

	if (intermediary.value === Network.lightning.value && txType !== 'withdraw') {
		return { action: 'v4v' };
	}

	return { action: 'send', intermediary };
}
