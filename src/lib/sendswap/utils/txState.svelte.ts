import { getContext, setContext } from 'svelte';
import type { CoinAmount } from '$lib/currency/CoinAmount';
import type { Coin } from './sendOptions';
import type { AssetOption, CoinOnNetwork, Network, TransferMethod } from './sendOptions';

// ─── Base (fields every flow shares) ─────────────────────────────────────────

export class TxStateBase {
	// ─── #3/#6 migration: new collapsed selection fields ───────────────────────
	// `from`/`to` carry the user's chosen (coin, network) as a single value —
	// matching what UI inputs produce (`CoinOnNetwork`). Eventually replaces the
	// paired `fromCoin`+`fromNetwork` / `toCoin`+`toNetwork` below.
	// `rail` is the explicit intermediary network — replaces the `method` field
	// (#6). When set (e.g. Reown-BTC lightning swap), it overrides the
	// `getIntermediaryNetwork(from, to)` derivation.
	from: CoinOnNetwork | undefined = $state(undefined);
	to: CoinOnNetwork | undefined = $state(undefined);
	rail: Network | undefined = $state(undefined);

	// ─── legacy fields (still authoritative; will be removed once consumers migrate)
	fromCoin: AssetOption | undefined = $state(undefined);
	fromNetwork: Network | undefined = $state(undefined);
	fromAmount: string = $state('0');
	toCoin: AssetOption | undefined = $state(undefined);
	toNetwork: Network | undefined = $state(undefined);
	toAmount: string = $state('0');
	toUsername: string = $state('');
	method: TransferMethod | undefined = $state(undefined);
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
