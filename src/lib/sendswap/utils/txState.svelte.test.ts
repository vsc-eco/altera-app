/**
 * Tests for the per-flow isolated $state refactor.
 *
 * These tests verify three things without touching the network or moving tokens:
 *  1. State isolation  — two flow instances never share fields (the original bug).
 *  2. Correct defaults — each class starts with the expected zero-state.
 *  3. Payload building — the kind-specific fields read by `send()` carry the
 *     right values for each flow kind, including BTC-specific ones.
 */

import { describe, it, expect } from 'vitest'
import {
	SwapTxState,
	TransferTxState,
	DepositTxState,
	WithdrawTxState,
	TxStateBase
} from './txState.svelte'
import { Coin, Network } from './sendOptions'
// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mirrors what send() reads from txState for the kind-specific fields.
 * (coin/network/amount wiring is not tested here — only the kind-specific fields.)
 */
function buildKindFields(txState: TxStateBase) {
	const carriesFeeFields =
		txState instanceof WithdrawTxState || txState instanceof TransferTxState
	return {
		toUsername: txState.toUsername,
		fromAmount: txState.fromAmount,
		memo: txState instanceof TransferTxState ? txState.memo : undefined,
		minAmountOut: txState instanceof SwapTxState ? txState.minAmountOut : undefined,
		deductFee: carriesFeeFields && txState.deductFee ? txState.deductFee : undefined,
		maxFee: carriesFeeFields ? txState.maxFee : undefined
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

	it('Withdraw flow fee fields are isolated from other flows', () => {
		const withdraw = new WithdrawTxState()
		const swap = new SwapTxState()

		withdraw.deductFee = true
		withdraw.maxFee = 5000

		// Other flows don't even have these fields on their class
		expect((swap as TxStateBase as { deductFee?: boolean }).deductFee).toBeUndefined()
		expect((swap as TxStateBase as { maxFee?: number }).maxFee).toBeUndefined()
	})
})

// ─── 2. Default values ────────────────────────────────────────────────────────

describe('default values — each class starts at zero-state', () => {
	it('TxStateBase shared fields default correctly', () => {
		const state = new SwapTxState()
		expect(state.toUsername).toBe('')
		expect(state.fromAmount).toBe('0')
		expect(state.toAmount).toBe('0')
		expect(state.from).toBeUndefined()
		expect(state.to).toBeUndefined()
	})

	it('SwapTxState-specific defaults', () => {
		const state = new SwapTxState()
		expect(state.kind).toBe('swap')
		expect(state.fee).toBeUndefined()
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
		expect(state.deductFee).toBe(false)
		expect(state.maxFee).toBeUndefined()
	})

	it('DepositTxState-specific defaults', () => {
		const state = new DepositTxState()
		expect(state.kind).toBe('deposit')
		expect(state.fee).toBeUndefined()
	})

	it('WithdrawTxState-specific defaults', () => {
		const state = new WithdrawTxState()
		expect(state.kind).toBe('withdraw')
		expect(state.fee).toBeUndefined()
		expect(state.deductFee).toBe(false)
		expect(state.maxFee).toBeUndefined()
	})
})

// ─── 3. Payload building ──────────────────────────────────────────────────────

describe('payload building — kind-specific fields read by send()', () => {
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
		expect(payload.deductFee).toBeUndefined()
		expect(payload.maxFee).toBeUndefined()
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
		expect(payload.deductFee).toBeUndefined()
		expect(payload.maxFee).toBeUndefined()
	})

	it('withdraw flow targeting BTC mainnet: deductFee and maxFee are included', () => {
		const state = new WithdrawTxState()
		state.toUsername = 'bc1qalice'
		state.deductFee = true
		state.maxFee = 3000

		const payload = buildKindFields(state)

		expect(payload.deductFee).toBe(true)
		expect(payload.maxFee).toBe(3000)
		expect(payload.memo).toBeUndefined()
		expect(payload.minAmountOut).toBeUndefined()
	})

	it('transfer flow targeting BTC mainnet: deductFee and maxFee also flow through', () => {
		// TransferOptions.svelte renders the BTC fee UI for external BTC transfers.
		// deductFee/maxFee live on both TransferTxState and WithdrawTxState so
		// they pass through for transfer kind too — previously a bug (kind ===
		// 'withdraw' guard in StepsMachine would have swallowed them).
		const state = new TransferTxState()
		state.toUsername = 'bc1qbob'
		state.deductFee = true
		state.maxFee = 5000

		const payload = buildKindFields(state)

		expect(payload.deductFee).toBe(true)
		expect(payload.maxFee).toBe(5000)
	})

	it('deductFee=false collapses to undefined in payload (no-op for contract)', () => {
		const state = new WithdrawTxState()
		state.deductFee = false

		const payload = buildKindFields(state)

		// false || undefined = undefined — the contract receives no deduct_fee flag
		expect(payload.deductFee).toBeUndefined()
	})

	it('deposit flow: no memo, no minAmountOut, no btc fields', () => {
		const state = new DepositTxState()
		state.toUsername = 'carol'
		state.fromAmount = '2000'

		const payload = buildKindFields(state)

		expect(payload.toUsername).toBe('carol')
		expect(payload.memo).toBeUndefined()
		expect(payload.minAmountOut).toBeUndefined()
		expect(payload.deductFee).toBeUndefined()
		expect(payload.maxFee).toBeUndefined()
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

// ─── 5. New from/to source-of-truth ──────────────────────────────────────────

describe('from/to/rail source-of-truth fields', () => {
	it('start undefined', () => {
		const state = new TransferTxState()
		expect(state.from).toBeUndefined()
		expect(state.to).toBeUndefined()
		expect(state.rail).toBeUndefined()
	})

	it('writing `from` does not touch `to` or `rail`', () => {
		const state = new TransferTxState()
		state.from = { coin: Coin.hive, network: Network.magi }
		expect(state.to).toBeUndefined()
		expect(state.rail).toBeUndefined()
	})

	it('writing `to` does not touch `from` or `rail`', () => {
		const state = new TransferTxState()
		state.to = { coin: Coin.hive, network: Network.hiveMainnet }
		expect(state.from).toBeUndefined()
		expect(state.rail).toBeUndefined()
	})

	it('writing `rail` does not touch `from` or `to`', () => {
		const state = new TransferTxState()
		state.rail = Network.lightning
		expect(state.from).toBeUndefined()
		expect(state.to).toBeUndefined()
		expect(state.rail.value).toBe(Network.lightning.value)
	})

	it('round-trips a CoinOnNetwork literal', () => {
		const state = new TransferTxState()
		state.from = { coin: Coin.btc, network: Network.btcMainnet }
		expect(state.from.coin.value).toBe(Coin.btc.value)
		expect(state.from.network.value).toBe(Network.btcMainnet.value)
	})
})

