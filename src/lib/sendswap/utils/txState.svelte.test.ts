/**
 * Tests for the per-flow isolated $state refactor.
 *
 * These tests verify three things without touching the network or moving tokens:
 *  1. State isolation  — two flow instances never share fields (the original bug).
 *  2. Correct defaults — each class starts with the expected zero-state.
 *  3. Payload building — the NecessarySendDetails fields produced for `send()`
 *     carry the right values for each flow kind, including BTC-specific ones.
 */

import { describe, it, expect } from 'vitest'
import {
	SwapTxState,
	TransferTxState,
	DepositTxState,
	WithdrawTxState,
	TxStateBase
} from './txState.svelte'
import type { NecessarySendDetails } from './sendOptions'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mirrors what StepsMachine.initSend() does: build the fields of
 * NecessarySendDetails that vary per flow kind.
 * (coin/network/amount wiring is not tested here — only the kind-specific fields.)
 */
function buildKindFields(txState: TxStateBase): Partial<NecessarySendDetails> {
	return {
		toUsername: txState.toUsername,
		fromAmount: txState.fromAmount,
		memo: txState.kind === 'transfer' ? (txState as TransferTxState).memo : undefined,
		minAmountOut: txState.kind === 'swap' ? (txState as SwapTxState).minAmountOut : undefined,
		btcDeductFee: txState.btcDeductFee || undefined,
		btcMaxFee: txState.btcMaxFee
	}
}

// ─── 1. State isolation ───────────────────────────────────────────────────────

describe('state isolation — two flow instances never share fields', () => {
	it('writing toUsername on SwapTxState does not affect a separate TransferTxState', () => {
		const swapState = new SwapTxState()
		const transferState = new TransferTxState()

		swapState.toUsername = 'alice'

		expect(transferState.toUsername).toBe('')
	})

	it('writing toUsername on TransferTxState does not affect a separate SwapTxState', () => {
		const swapState = new SwapTxState()
		const transferState = new TransferTxState()

		transferState.toUsername = 'bob'

		expect(swapState.toUsername).toBe('')
	})

	it('two SwapTxState instances are fully independent', () => {
		const s1 = new SwapTxState()
		const s2 = new SwapTxState()

		s1.toUsername = 'alice'
		s1.fromAmount = '1000'
		s1.minAmountOut = '950'

		expect(s2.toUsername).toBe('')
		expect(s2.fromAmount).toBe('0')
		expect(s2.minAmountOut).toBeUndefined()
	})

	it('two TransferTxState instances are fully independent', () => {
		const t1 = new TransferTxState()
		const t2 = new TransferTxState()

		t1.toUsername = 'charlie'
		t1.memo = 'payment'
		t1.toDisplayName = 'Charlie'

		expect(t2.toUsername).toBe('')
		expect(t2.memo).toBe('')
		expect(t2.toDisplayName).toBe('')
	})

	it('DepositTxState and WithdrawTxState do not share btc fields', () => {
		const deposit = new DepositTxState()
		const withdraw = new WithdrawTxState()

		withdraw.btcDeductFee = true
		withdraw.btcMaxFee = 5000

		expect(deposit.btcDeductFee).toBe(false)
		expect(deposit.btcMaxFee).toBeUndefined()
	})
})

// ─── 2. Default values ────────────────────────────────────────────────────────

describe('default values — each class starts at zero-state', () => {
	it('TxStateBase shared fields default correctly', () => {
		const state = new SwapTxState()
		expect(state.toUsername).toBe('')
		expect(state.fromAmount).toBe('0')
		expect(state.toAmount).toBe('0')
		expect(state.enteredAmount).toBe('0')
		expect(state.fee).toBeUndefined()
		expect(state.fromCoin).toBeUndefined()
		expect(state.toCoin).toBeUndefined()
		expect(state.fromNetwork).toBeUndefined()
		expect(state.toNetwork).toBeUndefined()
		expect(state.btcDeductFee).toBe(false)
		expect(state.btcMaxFee).toBeUndefined()
	})

	it('SwapTxState-specific defaults', () => {
		const state = new SwapTxState()
		expect(state.kind).toBe('swap')
		expect(state.expectedOutput).toBeUndefined()
		expect(state.slippageBps).toBe(100)
		expect(state.minAmountOut).toBeUndefined()
		expect(state.swapTotalFee).toBeUndefined()
		expect(state.swapHop1Fee).toBeUndefined()
	})

	it('TransferTxState-specific defaults', () => {
		const state = new TransferTxState()
		expect(state.kind).toBe('transfer')
		expect(state.memo).toBe('')
		expect(state.toDisplayName).toBe('')
	})

	it('DepositTxState kind', () => {
		expect(new DepositTxState().kind).toBe('deposit')
	})

	it('WithdrawTxState kind', () => {
		expect(new WithdrawTxState().kind).toBe('withdraw')
	})
})

// ─── 3. Payload building ──────────────────────────────────────────────────────

describe('payload building — kind-specific NecessarySendDetails fields', () => {
	it('swap flow: minAmountOut is included, memo is absent', () => {
		const state = new SwapTxState()
		state.toUsername = 'alice'
		state.fromAmount = '5000'
		state.minAmountOut = '4750'

		const payload = buildKindFields(state)

		expect(payload.toUsername).toBe('alice')
		expect(payload.fromAmount).toBe('5000')
		expect(payload.minAmountOut).toBe('4750')
		expect(payload.memo).toBeUndefined()
		expect(payload.btcDeductFee).toBeUndefined()
		expect(payload.btcMaxFee).toBeUndefined()
	})

	it('transfer flow: memo is included, minAmountOut is absent', () => {
		const state = new TransferTxState()
		state.toUsername = 'bob'
		state.fromAmount = '1000'
		state.memo = 'for lunch'

		const payload = buildKindFields(state)

		expect(payload.toUsername).toBe('bob')
		expect(payload.memo).toBe('for lunch')
		expect(payload.minAmountOut).toBeUndefined()
		expect(payload.btcDeductFee).toBeUndefined()
		expect(payload.btcMaxFee).toBeUndefined()
	})

	it('withdraw flow targeting BTC mainnet: btcDeductFee and btcMaxFee are included', () => {
		const state = new WithdrawTxState()
		state.toUsername = 'bc1qalice'
		state.btcDeductFee = true
		state.btcMaxFee = 3000

		const payload = buildKindFields(state)

		expect(payload.btcDeductFee).toBe(true)
		expect(payload.btcMaxFee).toBe(3000)
		expect(payload.memo).toBeUndefined()
		expect(payload.minAmountOut).toBeUndefined()
	})

	it('transfer flow targeting BTC mainnet: btcDeductFee and btcMaxFee also flow through', () => {
		// TransferOptions.svelte renders the BTC fee UI for external BTC transfers.
		// btcDeductFee/btcMaxFee live on TxStateBase so they pass through
		// for transfer kind too — previously a bug (kind === 'withdraw' guard
		// in StepsMachine would have swallowed them).
		const state = new TransferTxState()
		state.toUsername = 'bc1qbob'
		state.btcDeductFee = true
		state.btcMaxFee = 5000

		const payload = buildKindFields(state)

		expect(payload.btcDeductFee).toBe(true)
		expect(payload.btcMaxFee).toBe(5000)
	})

	it('btcDeductFee=false collapses to undefined in payload (no-op for contract)', () => {
		const state = new WithdrawTxState()
		state.btcDeductFee = false

		const payload = buildKindFields(state)

		// false || undefined = undefined — the contract receives no deduct_fee flag
		expect(payload.btcDeductFee).toBeUndefined()
	})

	it('deposit flow: no memo, no minAmountOut, no btc fields', () => {
		const state = new DepositTxState()
		state.toUsername = 'carol'
		state.fromAmount = '2000'

		const payload = buildKindFields(state)

		expect(payload.toUsername).toBe('carol')
		expect(payload.memo).toBeUndefined()
		expect(payload.minAmountOut).toBeUndefined()
		expect(payload.btcDeductFee).toBeUndefined()
		expect(payload.btcMaxFee).toBeUndefined()
	})
})

// ─── 4. The original bug — reproduced and verified fixed ─────────────────────

describe('original bug: QuickSwap writing toUsername must not reach QuickSend', () => {
	it('simulates the dashboard: swap sets toUsername, send stays blank', () => {
		// Before the refactor both widgets wrote to the same global SendTxDetails store.
		// Now each owns its own instance — changes in one are invisible to the other.
		const swapState = new SwapTxState()
		const sendState = new TransferTxState()

		// QuickSwap auto-fills toUsername with the signed-in user
		swapState.toUsername = 'myusername'

		// QuickSend's recipient must remain blank
		expect(sendState.toUsername).toBe('')
	})

	it('QuickSend sets a recipient without affecting QuickSwap destination', () => {
		const swapState = new SwapTxState()
		const sendState = new TransferTxState()

		sendState.toUsername = 'friend'

		expect(swapState.toUsername).toBe('')
	})
})
