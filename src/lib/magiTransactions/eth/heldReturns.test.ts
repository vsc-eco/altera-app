import { describe, expect, it, vi } from 'vitest';

// The bridge's state: head 0, tail 130; alice's returns at ids 5 and 100 (past
// the first chunk of 64), someone else's at 6.
vi.mock('$lib/queryOnce', () => ({
	queryOnce: vi.fn(async (_store: unknown, opts: { variables: { keys: string[] } }) => {
		const rec = (t: string) => JSON.stringify({ t, a: 'usdc', d: 1000000, ra: 'hbd', m: 900 });
		const state: Record<string, string> = {
			phrh: '0',
			phrt: '130',
			'phr-5': rec('hive:alice'),
			'phr-6': rec('hive:bob'),
			'phr-100': rec('hive:alice')
		};
		const out: Record<string, string | null> = {};
		for (const k of opts.variables.keys) out[k] = state[k] ?? null;
		return { data: { getStateByKeys: out } };
	})
}));

import {
	fetchHeldReturns,
	formatUnitsExact,
	parseHeldReturn,
	releaseHeldReturnCall
} from './heldReturns';

describe('held returns', () => {
	it('parses the bridge record', () => {
		expect(
			parseHeldReturn(3, '{"t":"hive:alice","a":"usdc","d":3409600,"ra":"hbd","m":4089}')
		).toEqual({
			id: 3,
			to: 'hive:alice',
			asset: 'usdc',
			amount: 3409600n,
			returnAsset: 'hbd',
			floor: 4089n,
			heldAt: 0
		});
		expect(
			parseHeldReturn(
				4,
				'{"t":"hive:alice","a":"eth","d":5,"ra":"hbd","m":7,"r":"0x00000000000000000000000000000000000000e2","g":60000,"s":1,"h":1763700000}'
			)
		).toMatchObject({ heldAt: 1763700000 });
		expect(parseHeldReturn(1, '')).toBeNull();
		expect(parseHeldReturn(1, 'nope')).toBeNull();
		expect(parseHeldReturn(1, '{"t":"hive:alice"}')).toBeNull();
	});
	it('shows amounts exactly, without trailing zeros', () => {
		expect(formatUnitsExact(24104039262343843n, 18)).toBe('0.024104039262343843');
		expect(formatUnitsExact(50000000000000000n, 18)).toBe('0.05');
		expect(formatUnitsExact(3409600n, 6)).toBe('3.4096');
		expect(formatUnitsExact(5000000n, 6)).toBe('5');
		expect(formatUnitsExact(7n, 8)).toBe('0.00000007');
	});
	it('reads every chunk from head to tail', async () => {
		const got = await fetchHeldReturns('hive:alice');
		expect(got.map((r) => r.id)).toEqual([5, 100]);
	});
	it('builds the two releases', () => {
		expect(JSON.parse(releaseHeldReturnCall(3, { minOut: 2641n }).payload)).toEqual({
			id: 3,
			min_out: '2641'
		});
		expect(
			JSON.parse(
				releaseHeldReturnCall(3, { toEthAddress: '0x00000000000000000000000000000000000000e2' })
					.payload
			)
		).toEqual({ id: 3, to: '0x00000000000000000000000000000000000000e2' });
		expect(releaseHeldReturnCall(3, { minOut: 1n }).action).toBe('releasePayoutReturn');
	});
});
