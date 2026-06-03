import { getContext, setContext } from 'svelte';
import type { CoinAmount } from '$lib/currency/CoinAmount';
import type { Coin, CoinOnNetwork, Network } from './sendOptions';
import { getIntermediaryNetwork } from './getNetwork';

// ─── Base (fields every flow shares) ─────────────────────────────────────────

export class TxStateBase {
	/**
	 * Selected source — coin + chosen network as a single value, matching what
	 * the asset/network picker produces (`CoinOnNetwork`). Use `getFromOption`
	 * if you need the list of *available* networks for the coin.
	 */
	from: CoinOnNetwork | undefined = $state(undefined);
	/** Selected destination, mirror of `from`. */
	to: CoinOnNetwork | undefined = $state(undefined);
	/**
	 * Explicit intermediary override. Set ONLY for flows whose rail can't be
	 * inferred from the from/to networks (e.g. the QuickSwap / /swap routes
	 * that bridge external assets via Lightning while neither network is
	 * Lightning). Read via the derived `rail` getter — never read this field
	 * directly outside of the writer.
	 */
	railOverride: Network | undefined = $state(undefined);

	/**
	 * The intermediary network this TX rails through. Derived from `from` and
	 * `to` via `getIntermediaryNetwork` by default; falls back to
	 * `railOverride` when set (for cases where the from/to networks don't
	 * indicate the rail — see `railOverride` doc).
	 */
	get rail(): Network | undefined {
		if (this.railOverride) return this.railOverride;
		if (!this.from || !this.to) return undefined;
		return getIntermediaryNetwork(this.from, this.to);
	}

	fromAmount: string = $state('0');
	toAmount: string = $state('0');
	toUsername: string = $state('');
}

// ─── Swap (QuickSwap card, /swap page) ───────────────────────────────────────

export class SwapTxState extends TxStateBase {
	readonly kind = 'swap' as const;
	/** Cross-chain bridge fee for the swap (Lightning gateway, etc). */
	fee: CoinAmount<Coin> | undefined = $state(undefined);
	expectedOutput: string | undefined = $state(undefined);
	slippageBps: number | undefined = $state(100);
	minAmountOut: string | undefined = $state(undefined);
	swapBaseFee: string | undefined = $state(undefined);
	swapClpFee: string | undefined = $state(undefined);
	swapTotalFee: string | undefined = $state(undefined);
	swapHop1Fee: { asset: string; totalFee: string } | undefined = $state(undefined);
	swapCalcPending: boolean = $state(false);
}

// ─── Transfer (QuickSend dialog, /transfer page) ──────────────────────────────

export class TransferTxState extends TxStateBase {
	readonly kind = 'transfer' as const;
	toDisplayName: string = $state('');
	memo: string = $state('');
	/** Whether to deduct the network fee from the output (e.g. BTC unmap via transfer). */
	deductFee: boolean = $state(false);
	/** Cap on the network fee in the source coin's smallest units. */
	maxFee: number | undefined = $state(undefined);
}

// ─── Deposit (L1 → Magi) ─────────────────────────────────────────────────────

export class DepositTxState extends TxStateBase {
	readonly kind = 'deposit' as const;
	/** Gateway fee for the deposit (Lightning, BTC mapping, etc). */
	fee: CoinAmount<Coin> | undefined = $state(undefined);
}

// ─── Withdraw (Magi → L1) ────────────────────────────────────────────────────

export class WithdrawTxState extends TxStateBase {
	readonly kind = 'withdraw' as const;
	/** Gateway fee for the withdrawal (Lightning, BTC unmap, etc). */
	fee: CoinAmount<Coin> | undefined = $state(undefined);
	/** Whether to deduct the network fee from the output (BTC unmap flow). */
	deductFee: boolean = $state(false);
	/** Cap on the network fee in the source coin's smallest units. */
	maxFee: number | undefined = $state(undefined);
}

// ─── Union & context ─────────────────────────────────────────────────────────

export type TxState = SwapTxState | TransferTxState | DepositTxState | WithdrawTxState;

const TX_STATE_KEY = Symbol('txState');

export function provideTxState(state: TxState) {
	setContext(TX_STATE_KEY, state);
}

export function useTxState(): TxState | undefined {
	const state = getContext<unknown>(TX_STATE_KEY);
	if (state instanceof TxStateBase) return state as TxState;
	return undefined;
}

/**
 * Like `useTxState()` but throws when called outside a TxState provider.
 *
 * Use this in flow-agnostic components that are mounted under every flow's
 * provider in normal use (Complete, ReviewSwap, Instructions, SelectContact,
 * …) — they don't care which specific subclass they get but they DO need a
 * non-undefined value, and a runtime throw is a clearer signal than the
 * silent ~65 `'txState' is possibly 'undefined'` TS warnings that the loose
 * `useTxState()` produces at every property access.
 *
 * Reach for `useTxState()` instead only when undefined is a legitimate
 * runtime state to handle (e.g. StepsMachine, which early-returns on it).
 */
export function requireTxState(): TxState {
	const state = useTxState();
	if (!state) {
		throw new Error(
			'requireTxState() called without a TxState provider (no `provideTxState(...)` ancestor)'
		);
	}
	return state;
}

export function useSwapState(): SwapTxState {
	const state = getContext<unknown>(TX_STATE_KEY);
	if (!(state instanceof SwapTxState)) {
		throw new Error(
			`useSwapState() called with unexpected context value (got ${state?.constructor?.name ?? typeof state})`
		);
	}
	return state;
}

export function useTransferState(): TransferTxState {
	const state = getContext<unknown>(TX_STATE_KEY);
	if (!(state instanceof TransferTxState)) {
		throw new Error(
			`useTransferState() called with unexpected context value (got ${state?.constructor?.name ?? typeof state})`
		);
	}
	return state;
}

export function useDepositState(): DepositTxState {
	const state = getContext<unknown>(TX_STATE_KEY);
	if (!(state instanceof DepositTxState)) {
		throw new Error(
			`useDepositState() called with unexpected context value (got ${state?.constructor?.name ?? typeof state})`
		);
	}
	return state;
}

export function useWithdrawState(): WithdrawTxState {
	const state = getContext<unknown>(TX_STATE_KEY);
	if (!(state instanceof WithdrawTxState)) {
		throw new Error(
			`useWithdrawState() called with unexpected context value (got ${state?.constructor?.name ?? typeof state})`
		);
	}
	return state;
}
