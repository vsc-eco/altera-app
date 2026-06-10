/**
 * Tests for the transactions-page client-side filter logic.
 *
 * All fixtures are hand-built TxListItems matching the real shapes:
 *   - vsc items carry ledger[] entries (smallest-unit integer amounts)
 *     and/or ops[] payloads (Hive L1 ops use human-unit decimal strings)
 *   - btc-deposit items carry indexer events (satoshi string amounts)
 *
 * The clock is injected so time-range assertions are deterministic.
 */
import { describe, expect, it } from 'vitest';
import {
	EMPTY_FILTERS,
	activeFilterCount,
	applyClientFilters,
	isFiltering,
	toServerFilterVars,
	type TxFilters
} from './filters';
import type { TxListItem } from '$lib/stores/txStores';

const NOW = Date.parse('2026-06-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function iso(msAgo: number): string {
	// Backend emits bare ISO without Z; getTimestamp appends it.
	return new Date(NOW - msAgo).toISOString().replace(/\.\d{3}Z$/, '');
}

/** Minimal vsc TxListItem with one ledger entry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vscTx(opts: {
	id: string;
	msAgo?: number;
	asset?: string;
	amount?: number; // smallest units
	from?: string;
	to?: string;
	type?: string;
	noLedger?: boolean;
	opType?: string;
	opData?: Record<string, unknown>;
}): TxListItem {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const tx: any = {
		id: opts.id,
		anchr_ts: iso(opts.msAgo ?? 0),
		first_seen: iso(opts.msAgo ?? 0),
		anchr_height: 1,
		status: 'CONFIRMED',
		isPending: false,
		ledger: opts.noLedger
			? []
			: [
					{
						asset: opts.asset ?? 'hive',
						amount: opts.amount ?? 1000,
						from: opts.from ?? 'hive:alice',
						to: opts.to ?? 'hive:bob',
						type: opts.type ?? 'transfer'
					}
				],
		ops: opts.opType
			? [{ type: opts.opType, index: 0, data: opts.opData ?? {} }]
			: []
	};
	return { kind: 'vsc', tx };
}

function btcDeposit(opts: { id: string; msAgo?: number; sats?: string }): TxListItem {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const event: any = {
		indexer_tx_hash: opts.id,
		indexer_ts: iso(opts.msAgo ?? 0),
		indexer_block_height: 1,
		amount: opts.sats ?? '150000',
		recipient: 'hive:carol',
		sender: 'bc1qsomebtcaddress'
	};
	return { kind: 'btc-deposit', event };
}

function f(partial: Partial<TxFilters>): TxFilters {
	return { ...EMPTY_FILTERS, ...partial };
}

// ─── isFiltering / activeFilterCount ─────────────────────────────────────────

describe('isFiltering & activeFilterCount', () => {
	it('EMPTY_FILTERS is not filtering', () => {
		expect(isFiltering(EMPTY_FILTERS)).toBe(false);
		expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
	});

	it('each filter group counts once', () => {
		expect(activeFilterCount(f({ tokens: ['hive'] }))).toBe(1);
		expect(activeFilterCount(f({ amountMin: 1, amountMax: 5 }))).toBe(1); // min+max = one group
		expect(
			activeFilterCount(
				f({ tokens: ['hive'], timeRange: '7d', types: ['transfer'], address: 'bob' })
			)
		).toBe(4);
	});

	it('whitespace-only address is not filtering', () => {
		expect(isFiltering(f({ address: '   ' }))).toBe(false);
	});
});

// ─── token filter ────────────────────────────────────────────────────────────

describe('token filter', () => {
	const items = [
		vscTx({ id: 'a', asset: 'hive' }),
		vscTx({ id: 'b', asset: 'hbd' }),
		vscTx({ id: 'c', asset: 'hbd_savings' }),
		btcDeposit({ id: 'd' })
	];

	it('keeps only matching assets', () => {
		const out = applyClientFilters(items, f({ tokens: ['hive'] }), NOW);
		expect(out.map((i) => (i.kind === 'vsc' ? i.tx.id : i.event.indexer_tx_hash))).toEqual(['a']);
	});

	it('normalizes suffixed assets (hbd_savings matches hbd)', () => {
		const out = applyClientFilters(items, f({ tokens: ['hbd'] }), NOW);
		expect(out).toHaveLength(2); // b + c
	});

	it('btc filter catches indexer btc-deposit items', () => {
		const out = applyClientFilters(items, f({ tokens: ['btc'] }), NOW);
		expect(out).toHaveLength(1);
		expect(out[0].kind).toBe('btc-deposit');
	});

	it('multi-token keeps the union', () => {
		const out = applyClientFilters(items, f({ tokens: ['hive', 'btc'] }), NOW);
		expect(out).toHaveLength(2);
	});
});

// ─── time range ──────────────────────────────────────────────────────────────

describe('time range filter', () => {
	const items = [
		vscTx({ id: 'fresh', msAgo: 1 * HOUR }),
		vscTx({ id: 'days', msAgo: 3 * DAY }),
		vscTx({ id: 'weeks', msAgo: 20 * DAY }),
		vscTx({ id: 'old', msAgo: 90 * DAY })
	];

	it('24h keeps only the fresh tx', () => {
		const out = applyClientFilters(items, f({ timeRange: '24h' }), NOW);
		expect(out.map((i) => (i.kind === 'vsc' ? i.tx.id : ''))).toEqual(['fresh']);
	});

	it('7d keeps fresh + days', () => {
		const out = applyClientFilters(items, f({ timeRange: '7d' }), NOW);
		expect(out).toHaveLength(2);
	});

	it('30d keeps everything but old', () => {
		const out = applyClientFilters(items, f({ timeRange: '30d' }), NOW);
		expect(out).toHaveLength(3);
	});

	it('all keeps everything', () => {
		const out = applyClientFilters(items, f({ timeRange: 'all' }), NOW);
		expect(out).toHaveLength(4);
	});
});

// ─── amount range ────────────────────────────────────────────────────────────

describe('amount filter (human units per entry asset)', () => {
	const items = [
		vscTx({ id: 'small', asset: 'hive', amount: 500 }), // 0.5 HIVE
		vscTx({ id: 'mid', asset: 'hive', amount: 25_000 }), // 25 HIVE
		vscTx({ id: 'big', asset: 'hive', amount: 1_000_000 }), // 1000 HIVE
		btcDeposit({ id: 'btc', sats: '150000' }) // 0.0015 BTC
	];

	it('min only', () => {
		const out = applyClientFilters(items, f({ amountMin: 10 }), NOW);
		expect(out).toHaveLength(2); // mid + big
	});

	it('max only', () => {
		const out = applyClientFilters(items, f({ amountMax: 1 }), NOW);
		expect(out).toHaveLength(2); // small (0.5) + btc (0.0015)
	});

	it('min+max window', () => {
		const out = applyClientFilters(items, f({ amountMin: 1, amountMax: 100 }), NOW);
		expect(out).toHaveLength(1); // mid
	});

	it('decimal-string op amounts are treated as human units', () => {
		// Hive L1 withdraw op: amount "5.453" (human units, not smallest)
		const item = vscTx({
			id: 'l1',
			noLedger: true,
			opType: 'withdraw',
			opData: { from: 'hive:x', to: 'hive:x', asset: 'hbd', amount: '5.453' }
		});
		expect(applyClientFilters([item], f({ amountMin: 5, amountMax: 6 }), NOW)).toHaveLength(1);
		expect(applyClientFilters([item], f({ amountMin: 100 }), NOW)).toHaveLength(0);
	});
});

// ─── type filter ─────────────────────────────────────────────────────────────

describe('type filter', () => {
	const items = [
		vscTx({ id: 't1', type: 'transfer' }),
		vscTx({ id: 't2', type: 'deposit' }),
		vscTx({ id: 't3', noLedger: true, opType: 'call_contract', opData: { action: 'swap' } }),
		vscTx({ id: 't4', type: 'stake' })
	];

	it('single type', () => {
		const out = applyClientFilters(items, f({ types: ['deposit'] }), NOW);
		expect(out).toHaveLength(1);
	});

	it("'call' matches call_contract ops too", () => {
		const out = applyClientFilters(items, f({ types: ['call'] }), NOW);
		expect(out).toHaveLength(1);
		expect(out[0].kind === 'vsc' && out[0].tx.id).toBe('t3');
	});

	it('multiple types = union', () => {
		const out = applyClientFilters(items, f({ types: ['transfer', 'stake'] }), NOW);
		expect(out).toHaveLength(2);
	});

	it('btc deposits count as type=deposit', () => {
		const out = applyClientFilters([btcDeposit({ id: 'b1' })], f({ types: ['deposit'] }), NOW);
		expect(out).toHaveLength(1);
	});
});

// ─── address filter ──────────────────────────────────────────────────────────

describe('address filter', () => {
	const items = [
		vscTx({ id: 'a1', from: 'hive:alice', to: 'hive:bob' }),
		vscTx({ id: 'a2', from: 'hive:carol', to: 'did:pkh:eip155:1:0xAbC123' }),
		btcDeposit({ id: 'a3' }) // sender bc1qsomebtcaddress, recipient hive:carol
	];

	it('matches partial account names case-insensitively', () => {
		expect(applyClientFilters(items, f({ address: 'ALICE' }), NOW)).toHaveLength(1);
	});

	it('matches either side (from or to)', () => {
		const out = applyClientFilters(items, f({ address: 'carol' }), NOW);
		expect(out).toHaveLength(2); // a2 (from) + a3 (recipient)
	});

	it('matches EVM-style addresses', () => {
		expect(applyClientFilters(items, f({ address: '0xabc' }), NOW)).toHaveLength(1);
	});

	it('matches BTC sender addresses on deposit events', () => {
		expect(applyClientFilters(items, f({ address: 'bc1q' }), NOW)).toHaveLength(1);
	});
});

// ─── combined filters ────────────────────────────────────────────────────────

describe('combined filters (AND across groups)', () => {
	const items = [
		vscTx({ id: 'x1', asset: 'hive', amount: 50_000, type: 'transfer', msAgo: HOUR }),
		vscTx({ id: 'x2', asset: 'hive', amount: 50_000, type: 'transfer', msAgo: 40 * DAY }),
		vscTx({ id: 'x3', asset: 'hbd', amount: 50_000, type: 'transfer', msAgo: HOUR }),
		vscTx({ id: 'x4', asset: 'hive', amount: 100, type: 'transfer', msAgo: HOUR })
	];

	it('token AND time AND amount all must pass', () => {
		const out = applyClientFilters(
			items,
			f({ tokens: ['hive'], timeRange: '7d', amountMin: 10 }),
			NOW
		);
		expect(out).toHaveLength(1);
		expect(out[0].kind === 'vsc' && out[0].tx.id).toBe('x1');
	});

	it('no filters → identity (same reference)', () => {
		expect(applyClientFilters(items, EMPTY_FILTERS, NOW)).toBe(items);
	});
});

// ─── server-side variable mapping ────────────────────────────────────────────

describe('toServerFilterVars', () => {
	it('empty filters → no vars', () => {
		expect(toServerFilterVars(EMPTY_FILTERS)).toEqual({});
	});

	it("expands 'call' to wire-level op names", () => {
		expect(toServerFilterVars(f({ types: ['call', 'transfer'] })).byType).toEqual([
			'call',
			'call_contract',
			'transfer'
		]);
	});

	it('passes full account ids through byLedgerToFrom', () => {
		expect(toServerFilterVars(f({ address: 'hive:alice' })).byLedgerToFrom).toBe('hive:alice');
	});

	it('does NOT pass partial text to byLedgerToFrom (exact-match would starve results)', () => {
		expect(toServerFilterVars(f({ address: 'alice' })).byLedgerToFrom).toBeUndefined();
	});
});
