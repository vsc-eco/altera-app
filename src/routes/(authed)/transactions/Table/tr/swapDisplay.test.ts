/**
 * Pins the swap-amount display contract that fixes the "same confirmed tx,
 * different numbers minutes apart" bug:
 *
 *   - A new-router swap normalises amount1 to min_amount_out (the slippage
 *     FLOOR) — so the consumer must NOT show amount1 as the received amount; it
 *     waits for the indexer's settled value.
 *   - isAwaitingSettledAmount marks exactly the window where the floor would
 *     otherwise leak into the UI (confirmed new-router swap, no indexer value
 *     yet) — and is false for old-pool swaps, pending swaps, and once settled.
 */
import { describe, expect, it } from 'vitest';
import {
	classifyContractOp,
	isAwaitingSettledAmount,
	swapEventHashCandidates
} from './swapDisplay';

describe('classifyContractOp — swap normalisation', () => {
	it('new-router swap: amount1 is min_amount_out (the floor, NOT the settled output)', () => {
		const { opKind, swapPayload } = classifyContractOp(
			{
				type: 'swap',
				asset_in: 'HBD',
				asset_out: 'HIVE',
				amount_in: 5320,
				min_amount_out: 99797 // the floor — real fill was 100311
			},
			'execute',
			0
		);
		expect(opKind).toBe('generic');
		expect(swapPayload).not.toBeNull();
		expect(swapPayload?.isNewRouter).toBe(true);
		expect(swapPayload?.asset0).toBe('hbd');
		expect(swapPayload?.amount0).toBe('5320');
		expect(swapPayload?.asset1).toBe('hive');
		// amount1 is the FLOOR — the consumer must not display it for a confirmed swap.
		expect(swapPayload?.amount1).toBe('99797');
	});

	it('new-router swap missing min_amount_out → floor defaults to "0"', () => {
		const { swapPayload } = classifyContractOp(
			{ type: 'swap', asset_in: 'HBD', asset_out: 'HIVE', amount_in: 5320 },
			'execute',
			0
		);
		expect(swapPayload?.isNewRouter).toBe(true);
		expect(swapPayload?.amount1).toBe('0');
	});

	it('old-pool swap: amount1 is the settled value (isNewRouter false, no indexer needed)', () => {
		const { swapPayload } = classifyContractOp(
			{ asset0: 'hbd', amount0: '5320', asset1: 'hive', amount1: '100311' },
			'execute',
			0
		);
		expect(swapPayload?.isNewRouter).toBe(false);
		expect(swapPayload?.amount1).toBe('100311');
	});

	it('add-liquidity (deposit + ≥2 intents) is not a swap', () => {
		const { opKind, swapPayload } = classifyContractOp(
			{ type: 'deposit', asset0: 'hive', amount0: '1', asset1: 'hbd', amount1: '2' },
			'execute',
			2
		);
		expect(opKind).toBe('add-liquidity');
		expect(swapPayload).toBeNull();
	});

	it('remove-liquidity (withdrawal + lp_amount) is not a swap', () => {
		const { opKind, swapPayload } = classifyContractOp(
			{ type: 'withdrawal', lp_amount: '42' },
			'execute',
			0
		);
		expect(opKind).toBe('remove-liquidity');
		expect(swapPayload).toBeNull();
	});

	it('non-execute action or unparsable payload → generic, no swap', () => {
		expect(classifyContractOp({ type: 'swap' }, 'register', 0)).toEqual({
			opKind: 'generic',
			swapPayload: null
		});
		expect(classifyContractOp(null, 'execute', 0)).toEqual({
			opKind: 'generic',
			swapPayload: null
		});
	});
});

describe('swapEventHashCandidates — bare hash + op-index-suffixed key', () => {
	it('returns both the bare hash and `<hash>-<opIndex>`', () => {
		// Standalone swap (op 0): the indexer stores the bare hash.
		expect(swapEventHashCandidates('0d9538', 0)).toEqual(['0d9538', '0d9538-0']);
		// Bundled swap (op 1, e.g. deposit+swap): indexer suffixes with -1.
		expect(swapEventHashCandidates('666309', 1)).toEqual(['666309', '666309-1']);
	});
});

describe('isAwaitingSettledAmount — when the floor must be hidden', () => {
	const base = { isSwap: true, isNewRouter: true, isPending: false, hasIndexerAmount: false };

	it('confirmed new-router swap with no indexer value yet → awaiting (hide floor)', () => {
		expect(isAwaitingSettledAmount(base)).toBe(true);
	});

	it('once the settled amount arrives → not awaiting', () => {
		expect(isAwaitingSettledAmount({ ...base, hasIndexerAmount: true })).toBe(false);
	});

	it('pending swap → not awaiting (min-out is a legitimate expected-minimum here)', () => {
		expect(isAwaitingSettledAmount({ ...base, isPending: true })).toBe(false);
	});

	it('old-pool swap → not awaiting (settled amount is already in the payload)', () => {
		expect(isAwaitingSettledAmount({ ...base, isNewRouter: false })).toBe(false);
	});

	it('non-swap contract call → not awaiting', () => {
		expect(isAwaitingSettledAmount({ ...base, isSwap: false })).toBe(false);
	});
});
