/**
 * Pure display helpers for contract-call transactions (swaps / liquidity).
 *
 * Extracted from ContractTr.svelte so the swap-amount decision logic can be
 * unit-tested without rendering the component. The crux pinned here:
 *
 *   For a NEW-ROUTER swap, `amount1` is `min_amount_out` — the slippage FLOOR,
 *   not the executed output. It must never be shown as the received amount on a
 *   confirmed swap; the real value comes from the indexer's settled
 *   `amount_out`. `isAwaitingSettledAmount` marks the window where the floor
 *   would otherwise leak into the UI (the "same tx, different numbers minutes
 *   apart" bug).
 *
 *   Old-pool swaps carry the settled value directly in `amount1`, so they need
 *   no indexer round-trip (isNewRouter: false).
 */

export type OpKind = 'swap' | 'add-liquidity' | 'remove-liquidity' | 'generic';

export type NormalizedSwap = {
	asset0: string;
	amount0: string;
	asset1: string;
	amount1: string;
	/** New router → amount1 is min_amount_out (floor). Old pool → amount1 is settled. */
	isNewRouter: boolean;
};

/**
 * Classify a contract op and, when it's a swap, normalise both payload formats
 * to `{ asset0, amount0, asset1, amount1, isNewRouter }`.
 *
 * @param parsedPayload  JSON.parse of op.data.payload (or null on parse failure)
 * @param action         op.data.action
 * @param intentCount    op.data.intents?.length ?? 0
 */
export function classifyContractOp(
	parsedPayload: Record<string, unknown> | null,
	action: string | undefined,
	intentCount: number
): { opKind: OpKind; swapPayload: NormalizedSwap | null } {
	if (action !== 'execute' || !parsedPayload) return { opKind: 'generic', swapPayload: null };
	const p = parsedPayload;

	// Add liquidity: payload type="deposit" + 2 intents (both assets sent in)
	if (
		p.type === 'deposit' &&
		p.asset0 &&
		p.asset1 &&
		p.amount0 != null &&
		p.amount1 != null &&
		intentCount >= 2
	) {
		return { opKind: 'add-liquidity', swapPayload: null };
	}

	// Remove liquidity: payload type="withdrawal" + lp_amount present
	if (p.type === 'withdrawal' && p.lp_amount != null) {
		return { opKind: 'remove-liquidity', swapPayload: null };
	}

	// ── Swap detection (opKind stays 'generic'; swap is a sub-classification) ──
	// New router format: { type:"swap", asset_in, asset_out, amount_in, min_amount_out }
	if (p.type === 'swap' && p.asset_in && p.asset_out && p.amount_in != null) {
		return {
			opKind: 'generic',
			swapPayload: {
				asset0: String(p.asset_in).toLowerCase(),
				amount0: String(p.amount_in),
				asset1: String(p.asset_out).toLowerCase(),
				amount1: String(p.min_amount_out ?? '0'),
				isNewRouter: true
			}
		};
	}
	// Old pool format — amount1 is the settled value. Only match when intent
	// count ≤ 1 (add-liquidity has ≥ 2 intents and is already classified above).
	if (
		p.asset0 &&
		p.asset1 &&
		p.amount0 != null &&
		p.amount1 != null &&
		(!p.type || p.type === 'swap' || p.type === 'deposit')
	) {
		return {
			opKind: 'generic',
			swapPayload: {
				asset0: String(p.asset0),
				amount0: String(p.amount0),
				asset1: String(p.asset1),
				amount1: String(p.amount1),
				isNewRouter: false
			}
		};
	}

	return { opKind: 'generic', swapPayload: null };
}

/**
 * The indexer keys a swap event by either the bare tx hash (standalone swap at
 * op 0) OR `<hash>-<opIndex>` when the swap is bundled with another op in the
 * same tx (deposit+swap, BTC increaseAllowance+swap, …). Query BOTH so bundled
 * swaps resolve — matching only the bare hash leaves them stuck "confirming".
 */
export function swapEventHashCandidates(txId: string, opIndex: number): string[] {
	return [txId, `${txId}-${opIndex}`];
}

/**
 * True while a confirmed new-router swap's settled output is still unknown — the
 * window in which the UI must show a loading placeholder instead of the
 * min_amount_out floor. Old-pool swaps (settled amount in-payload), pending
 * swaps, and FAILED swaps are never "awaiting" — a failed swap will never
 * settle an amount, so it should show its failed status, not the loading dots.
 */
export function isAwaitingSettledAmount(args: {
	isSwap: boolean;
	isNewRouter: boolean;
	isPending: boolean;
	hasIndexerAmount: boolean;
	/** A failed swap never settles — it's done, not "awaiting". */
	isFailed: boolean;
}): boolean {
	return (
		args.isSwap && args.isNewRouter && !args.isPending && !args.hasIndexerAmount && !args.isFailed
	);
}
