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

const { fetchTxs, magiTxsStore, clearAllStores, useStoresFor } = await import('./txStores');

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

/**
 * The transactions page can show another account, but the stores are shared
 * with the dashboard and the Transfer page's recent contacts. Rows of one
 * account must never end up in another account's list.
 */
describe('stores follow one account at a time', () => {
	const OTHER = 'hive:someone-else';

	it('pointing the stores at another account empties them', async () => {
		await fetchTxs(DID, 'set');
		expect(get(magiTxsStore)).toHaveLength(1);
		useStoresFor(OTHER);
		expect(get(magiTxsStore)).toEqual([]);
		// Same account again is a no-op.
		feed = [mkTx('tx-9', 109)];
		await fetchTxs(OTHER, 'set');
		useStoresFor(OTHER);
		expect(get(magiTxsStore).map((t) => t.id)).toEqual(['tx-9']);
	});

	it('drops a response that lands after the stores moved to another account', async () => {
		// Hold the first account's poll in flight until we release it.
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init: RequestInit) => {
				const did = JSON.parse(String(init.body)).variables.did;
				if (did === DID) await gate;
				const rows = did === DID ? [mkTx('mine', 100)] : [mkTx('theirs', 200)];
				return new Response(JSON.stringify({ data: { findTransaction: rows } }), { status: 200 });
			})
		);

		const stalePoll = fetchTxs(DID, 'update');
		await fetchTxs(OTHER, 'set');
		release();
		expect(await stalePoll).toBe(false);
		expect(get(magiTxsStore).map((t) => t.id)).toEqual(['theirs']);
	});

	it("an 'extend' for a different account starts fresh instead of appending", async () => {
		feed = [mkTx('theirs', 200)];
		await fetchTxs(OTHER, 'set');
		feed = [mkTx('mine', 100)];
		await fetchTxs(DID, 'extend');
		expect(get(magiTxsStore).map((t) => t.id)).toEqual(['mine']);
	});
});
