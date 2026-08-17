/**
 * The transactions list refreshes by polling `fetchTxs(did, 'update')` every
 * 2s and writing into `magiTxsStore` — NOT via the Houdini cache pushing into
 * the query store (nothing renders a Houdini store in this app). This pins
 * that: after `queryOnce` releases the cache subscription, a later poll still
 * picks up a newly confirmed transaction.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/indexer/btcMappingQueries', () => ({
	fetchBtcDepositsByRecipient: async () => []
}));

const { fetchTxs, magiTxsStore, clearAllStores } = await import('./txStores');

const DID = 'hive:tester';

const mkTx = (id: string, height: number) => ({
	anchr_height: height,
	anchr_ts: '2026-08-17T10:00:00Z',
	first_seen: '2026-08-17T10:00:00Z',
	id,
	ledger: [{ amount: 1, asset: 'hbd', from: DID, memo: '', to: 'hive:b', type: 'transfer' }],
	ops: [{ data: {}, index: 0, type: 'transfer' }],
	output: [{ id: `out-${id}`, index: 0 }],
	status: 'CONFIRMED',
	type: 'transfer'
});

/** Newest-first, like the indexer returns. */
let feed = [mkTx('tx-1', 100)];

beforeEach(() => {
	clearAllStores();
	feed = [mkTx('tx-1', 100)];
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () => new Response(JSON.stringify({ data: { findTransaction: feed } }), { status: 200 })
		)
	);
});

describe('fetchTxs', () => {
	it('picks up new transactions on a later poll', async () => {
		await fetchTxs(DID, 'set');
		expect(get(magiTxsStore).map((t) => t.id)).toEqual(['tx-1']);

		// A new transaction lands on chain between polls.
		feed = [mkTx('tx-2', 101), mkTx('tx-1', 100)];
		await fetchTxs(DID, 'update');
		expect(get(magiTxsStore).map((t) => t.id)).toEqual(['tx-2', 'tx-1']);

		feed = [mkTx('tx-3', 102), mkTx('tx-2', 101), mkTx('tx-1', 100)];
		await fetchTxs(DID, 'update');
		expect(get(magiTxsStore).map((t) => t.id)).toEqual(['tx-3', 'tx-2', 'tx-1']);
	});
});
