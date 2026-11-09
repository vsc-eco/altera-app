/**
 * Pins the mapping from a raw `vsc-output` DAG node to the message the failed
 * badge shows. The shapes below are copied from live mainnet outputs
 * (api.okinoko.io), where a reverted swap reads:
 *
 *   results: [{ err: 'ledger_error', errMsg: 'insufficient balance',
 *               ok: false, ret: '' }]
 *
 * — i.e. the GraphQL projection of `{ ok, ret }` alone shows nothing, which is
 * why the reason has to come from the DAG.
 */
import { describe, expect, it } from 'vitest';
import { normalizeDag, opInputId, pickFailureReason } from './failureReason';

const TX = 'ec8b63df21f35d2ab581b4988e2a6793fd5230fb';

describe('opInputId', () => {
	it('matches the node MakeTxId: bare id for op 0, suffixed after that', () => {
		expect(opInputId(TX, 0)).toBe(TX);
		expect(opInputId(TX, 1)).toBe(`${TX}-1`);
	});
});

describe('normalizeDag', () => {
	it('parses the JSON string the node actually returns', () => {
		const dag = normalizeDag('{"results":[{"ok":false,"errMsg":"insufficient balance"}]}');
		expect(dag?.results?.[0].errMsg).toBe('insufficient balance');
	});
	it('accepts an already-decoded object', () => {
		expect(normalizeDag({ inputs: ['a'] })?.inputs).toEqual(['a']);
	});
	it('returns null for junk rather than throwing', () => {
		expect(normalizeDag('not json')).toBeNull();
		expect(normalizeDag(null)).toBeNull();
		expect(normalizeDag(42)).toBeNull();
		expect(normalizeDag(['a'])).toBeNull();
	});
});

describe('pickFailureReason', () => {
	it('reads errMsg for the row own operation', () => {
		const reason = pickFailureReason(
			[
				{
					ref: { id: 'bafy1', index: [0] },
					dag: {
						inputs: [TX],
						results: [{ ok: false, ret: '', err: 'ledger_error', errMsg: 'insufficient balance' }]
					}
				}
			],
			TX,
			0
		);
		expect(reason).toEqual({
			message: 'insufficient balance',
			code: 'ledger_error',
			hasMessage: true,
			fromSiblingOp: false
		});
	});

	it('falls back to a sibling op failure and says so (the whole tx reverts)', () => {
		// A deposit (op 0) + swap (op 1) transaction: only the swap produced a
		// contract output, but the deposit row is FAILED too.
		const reason = pickFailureReason(
			[
				{
					ref: { id: 'bafy1', index: [0] },
					dag: {
						inputs: [`${TX}-1`],
						results: [{ ok: false, ret: '', err: 'ledger_error', errMsg: 'insufficient balance' }]
					}
				}
			],
			TX,
			0
		);
		expect(reason?.message).toBe('insufficient balance');
		expect(reason?.fromSiblingOp).toBe(true);
	});

	it('prefers the row own operation over a sibling', () => {
		const reason = pickFailureReason(
			[
				{
					ref: { id: 'bafy1', index: [0, 1] },
					dag: {
						inputs: [`${TX}-1`, TX],
						results: [
							{ ok: false, errMsg: 'sibling failed' },
							{ ok: false, errMsg: 'this op failed' }
						]
					}
				}
			],
			TX,
			0
		);
		expect(reason?.message).toBe('this op failed');
		expect(reason?.fromSiblingOp).toBe(false);
	});

	it('never reports another transaction error from a batched output', () => {
		const reason = pickFailureReason(
			[
				{
					// `index` points only at our result; the other one belongs
					// to a different transaction in the same output.
					ref: { id: 'bafy1', index: [1] },
					dag: {
						inputs: ['deadbeef', TX],
						results: [
							{ ok: false, errMsg: 'someone else problem' },
							{ ok: false, errMsg: 'ours' }
						]
					}
				}
			],
			TX,
			0
		);
		expect(reason?.message).toBe('ours');
	});

	it('ignores successful results and outputs that could not be fetched', () => {
		expect(
			pickFailureReason(
				[
					{ ref: { id: 'bafy0' }, dag: null },
					{ ref: { id: 'bafy1' }, dag: { inputs: [TX], results: [{ ok: true, ret: '{}' }] } }
				],
				TX,
				0
			)
		).toBeNull();
	});

	it('uses ret when the message landed there instead of errMsg', () => {
		const reason = pickFailureReason(
			[
				{
					ref: { id: 'bafy1' },
					dag: { inputs: [TX], results: [{ ok: false, ret: 'reverted: bad input' }] }
				}
			],
			TX,
			0
		);
		expect(reason?.message).toBe('reverted: bad input');
		expect(reason?.hasMessage).toBe(true);
	});

	it('falls back to a readable label when only an error code was recorded', () => {
		const reason = pickFailureReason(
			[
				{
					ref: { id: 'bafy1' },
					dag: { inputs: [TX], results: [{ ok: false, ret: '', err: 'gas_limit_hit' }] }
				}
			],
			TX,
			0
		);
		expect(reason).toEqual({
			message: 'The call ran out of gas.',
			code: 'gas_limit_hit',
			hasMessage: false,
			fromSiblingOp: false
		});
	});

	it('humanises an unknown error code rather than showing nothing', () => {
		const reason = pickFailureReason(
			[
				{
					ref: { id: 'bafy1' },
					dag: { inputs: [TX], results: [{ ok: false, err: 'some_new_code' }] }
				}
			],
			TX,
			0
		);
		expect(reason?.message).toBe('some new code');
	});

	it('scans every result when the output carries no index hint', () => {
		const reason = pickFailureReason(
			[
				{
					ref: { id: 'bafy1', index: [] },
					dag: {
						inputs: ['other', `${TX}-2`],
						results: [
							{ ok: true, ret: '' },
							{ ok: false, errMsg: 'found anyway' }
						]
					}
				}
			],
			TX,
			2
		);
		expect(reason?.message).toBe('found anyway');
		expect(reason?.fromSiblingOp).toBe(false);
	});
});
