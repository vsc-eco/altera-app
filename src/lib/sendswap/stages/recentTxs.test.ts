import { describe, expect, it } from 'vitest';
import { dedupeTxsById } from './recentTxs.svelte';

describe('dedupeTxsById', () => {
	/** The bug this exists for: a duplicate tx becomes a duplicate {#each} key,
	 *  Svelte throws each_key_duplicate, and the rail breaks for good. */
	it('keeps the first occurrence of each id', () => {
		const out = dedupeTxsById([{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'c' }]);
		expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
	});

	it('preserves order', () => {
		const out = dedupeTxsById([{ id: 'z' }, { id: 'y' }, { id: 'x' }]);
		expect(out.map((t) => t.id)).toEqual(['z', 'y', 'x']);
	});

	it('keeps the first object, not a later copy', () => {
		const first = { id: 'a', n: 1 };
		const second = { id: 'a', n: 2 };
		expect(dedupeTxsById([first, second])[0]).toBe(first);
	});

	/** Dropping an id-less entry would hide real activity. */
	it('keeps entries with no usable id', () => {
		const out = dedupeTxsById([{ id: 'a' }, { id: '' }, { id: null }, { id: undefined }, { id: 'a' }]);
		expect(out).toHaveLength(4);
		expect(out[0].id).toBe('a');
	});

	it('handles an empty list', () => {
		expect(dedupeTxsById([])).toEqual([]);
	});
});
