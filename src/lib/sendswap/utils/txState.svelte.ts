import { getContext, setContext } from 'svelte';
import type { CoinAmount } from '$lib/currency/CoinAmount';
import { getFromOption, getToOption, type AssetOption, type Coin, type CoinOnNetwork, type Network } from './sendOptions';

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
	 * Optional intermediary override. When `undefined`, callers derive the
	 * intermediary via `getIntermediaryNetwork(from, to)`; set explicitly only
	 * for flows whose rail can't be inferred from the from/to networks (e.g.
	 * the Reown-BTC → HIVE swap that goes via Lightning while neither network
	 * is Lightning).
	 */
	rail: Network | undefined = $state(undefined);

	fromAmount: string = $state('0');
	toAmount: string = $state('0');
	toUsername: string = $state('');

	// ─── Legacy shims (migration-only) ──────────────────────────────────────────
	// These bridge the paired (fromCoin/fromNetwork, toCoin/toNetwork) API to
	// the collapsed `from`/`to: CoinOnNetwork` source of truth. They exist so
	// existing consumers keep working while each file is migrated to read/write
	// the new fields directly. **Do not introduce new usages** — read `.from` /
	// `.to` instead. Will be removed once every consumer is migrated.

	/** @deprecated read `txState.from?.coin` and look the AssetOption up via `getFromOption()` if you need the list of available networks. */
	get fromCoin(): AssetOption | undefined {
		return this.from ? getFromOption(this.from.coin.value) : undefined;
	}
	set fromCoin(v: AssetOption | undefined) {
		if (!v) {
			this.from = undefined;
			return;
		}
		const net = this.from?.network ?? v.networks[0];
		if (net) this.from = { coin: v.coin, network: net };
	}
	/** @deprecated read `txState.from?.network`. */
	get fromNetwork(): Network | undefined {
		return this.from?.network;
	}
	set fromNetwork(v: Network | undefined) {
		if (!v) {
			this.from = undefined;
			return;
		}
		if (this.from?.coin) this.from = { coin: this.from.coin, network: v };
	}
	/** @deprecated read `txState.to?.coin` and look the AssetOption up via `getToOption()` if you need the list of available networks. */
	get toCoin(): AssetOption | undefined {
		return this.to ? getToOption(this.to.coin.value) : undefined;
	}
	set toCoin(v: AssetOption | undefined) {
		if (!v) {
			this.to = undefined;
			return;
		}
		const net = this.to?.network ?? v.networks[0];
		if (net) this.to = { coin: v.coin, network: net };
	}
	/** @deprecated read `txState.to?.network`. */
	get toNetwork(): Network | undefined {
		return this.to?.network;
	}
	set toNetwork(v: Network | undefined) {
		if (!v) {
			this.to = undefined;
			return;
		}
		if (this.to?.coin) this.to = { coin: this.to.coin, network: v };
	}
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
