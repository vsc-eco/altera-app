import { getContext, setContext } from 'svelte'
import type { CoinAmount } from '$lib/currency/CoinAmount'
import type { Coin } from './sendOptions'
import type { CoinOptions, Network, TransferMethod, SendAccount } from './sendOptions'

// ─── Base (fields every flow shares) ─────────────────────────────────────────

export class TxStateBase {
	fromCoin: CoinOptions['coins'][number] | undefined = $state(undefined)
	fromNetwork: Network | undefined = $state(undefined)
	fromAmount: string = $state('0')
	enteredAmount: string = $state('0')
	toCoin: CoinOptions['coins'][number] | undefined = $state(undefined)
	toNetwork: Network | undefined = $state(undefined)
	toAmount: string = $state('0')
	toUsername: string = $state('')
	fee: CoinAmount<Coin> | undefined = $state(undefined)
	method: TransferMethod | undefined = $state(undefined)
	account: SendAccount | undefined = $state(undefined)
	/** Whether to deduct the BTC network fee from the output (BTC unmap flows). */
	btcDeductFee: boolean = $state(false)
	/** Sat cap on the BTC network fee (BTC unmap flows). */
	btcMaxFee: number | undefined = $state(undefined)
}

// ─── Swap (QuickSwap card, /swap page) ───────────────────────────────────────

export class SwapTxState extends TxStateBase {
	readonly kind = 'swap' as const
	expectedOutput: string | undefined = $state(undefined)
	slippageBps: number | undefined = $state(100)
	minAmountOut: string | undefined = $state(undefined)
	swapBaseFee: string | undefined = $state(undefined)
	swapClpFee: string | undefined = $state(undefined)
	swapTotalFee: string | undefined = $state(undefined)
	swapHop1Fee: { asset: string; totalFee: string } | undefined = $state(undefined)
}

// ─── Transfer (QuickSend dialog, /transfer page) ──────────────────────────────

export class TransferTxState extends TxStateBase {
	readonly kind = 'transfer' as const
	toDisplayName: string = $state('')
	memo: string = $state('')
}

// ─── Deposit (L1 → Magi) ─────────────────────────────────────────────────────

export class DepositTxState extends TxStateBase {
	readonly kind = 'deposit' as const
}

// ─── Withdraw (Magi → L1) ────────────────────────────────────────────────────

export class WithdrawTxState extends TxStateBase {
	readonly kind = 'withdraw' as const
}

// ─── Union & context ─────────────────────────────────────────────────────────

export type TxState = SwapTxState | TransferTxState | DepositTxState | WithdrawTxState

const TX_STATE_KEY = Symbol('txState')

export function provideTxState(state: TxState) {
	setContext(TX_STATE_KEY, state)
}

export function useTxState(): TxState {
	return getContext<TxState>(TX_STATE_KEY)
}

export function useSwapState(): SwapTxState {
	return getContext<SwapTxState>(TX_STATE_KEY)
}

export function useTransferState(): TransferTxState {
	return getContext<TransferTxState>(TX_STATE_KEY)
}

export function useDepositState(): DepositTxState {
	return getContext<DepositTxState>(TX_STATE_KEY)
}

export function useWithdrawState(): WithdrawTxState {
	return getContext<WithdrawTxState>(TX_STATE_KEY)
}
