/**
 * Loader tests — pin the wire-shape contract against PR #210.
 *
 * Each fixture in this file is hand-built from the schema definitions
 * in `go-vsc-node` PR #210
 * (https://github.com/vsc-eco/go-vsc-node/pull/210):
 *
 *   findPendingContractUpdates(filterOptions: FindContractFilter): [Contract]
 *
 *   type Contract adds:
 *     activation_height: Uint64!
 *     activation_ts: String        # ISO 8601, same format as creation_ts
 *     proposer: String
 *
 * If the live backend ever returns a different shape, one of these
 * tests fails loudly — and the diff tells us exactly where to update
 * `loader.ts` / `types.ts`. That's the whole point: we don't want the
 * "frontend silently rendering wrong data" failure mode that prompted
 * the 0.3.15 stabilizer incident.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPendingUpdates, loadUpdateById } from './loader';
import { CONTRACT_REGISTRY } from './mockData';
import { tsToUnixSec } from './types';

// ─── Fixtures (PR #210 wire shape) ────────────────────────────────────────

/**
 * A single pending update for a contract we know about (HIVE/HBD pool).
 * Should enrich with the registry metadata.
 */
const FIXTURE_KNOWN: unknown = {
	id: 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp', // matches CONTRACT_REGISTRY
	code: 'bafkreibrlaku3dmnexnxz4lbplkotf52mwnwie3tro73jn7wxhwkagi_LIVE_NEWCID',
	proposer: 'vaultec',
	owner: 'hive:vsc.dao',
	creation_height: 107_500_000,
	activation_height: 107_672_800,
	activation_ts: '2026-06-08T12:34:56' // matches Contract.creation_ts format on prod
};

/**
 * A pending update for an UNKNOWN contract (not in CONTRACT_REGISTRY).
 * Should still appear in the list, just without `metadata`.
 */
const FIXTURE_UNKNOWN: unknown = {
	id: 'vsc1UnknownContractIdNotInRegistry',
	code: 'bafkreiUnknownNewCidForUnregisteredContract',
	proposer: 'someuser',
	owner: 'hive:someuser',
	creation_height: 107_510_000,
	activation_height: 107_682_800,
	activation_ts: '2026-06-08T13:14:15'
};

// ─── fetch stub helpers ───────────────────────────────────────────────────

function stubFetchOk(body: unknown) {
	const fetchMock = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: () => Promise.resolve(body)
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function stubFetchHttp(status: number) {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: false,
			status,
			json: () => Promise.resolve({})
		})
	);
}

function stubFetchThrows(err: Error) {
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

// ─── loadPendingUpdates ───────────────────────────────────────────────────

describe('loadPendingUpdates — live path', () => {
	it('returns source=live with both updates and enriches known ones with metadata', async () => {
		stubFetchOk({
			data: {
				findPendingContractUpdates: [FIXTURE_KNOWN, FIXTURE_UNKNOWN]
			}
		});

		const result = await loadPendingUpdates();

		expect(result.source).toBe('live');
		expect(result.updates).toHaveLength(2);

		const known = result.updates[0];
		expect(known.id).toBe('vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp');
		expect(known.code).toMatch(/_LIVE_NEWCID$/);
		expect(known.proposer).toBe('vaultec');
		expect(known.owner).toBe('hive:vsc.dao');
		expect(known.creation_height).toBe(107_500_000);
		expect(known.activation_height).toBe(107_672_800);
		expect(known.activation_ts).toBe('2026-06-08T12:34:56');
		// Enriched with registry metadata:
		expect(known.metadata).toEqual(CONTRACT_REGISTRY['vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp']);
		expect(known.metadata?.name).toBe('Pool: HIVE / HBD');

		const unknown = result.updates[1];
		expect(unknown.id).toBe('vsc1UnknownContractIdNotInRegistry');
		// Unknown contract: no metadata, but still rendered.
		expect(unknown.metadata).toBeUndefined();
	});

	it('returns source=live + empty array when backend has no pending updates', async () => {
		// Field exists, nothing queued. This is the steady-state "all green" UI.
		stubFetchOk({
			data: {
				findPendingContractUpdates: []
			}
		});

		const result = await loadPendingUpdates();

		expect(result.source).toBe('live');
		expect(result.updates).toEqual([]);
	});

	it('returns source=live + empty when backend returns null for the field', async () => {
		// Defensive: some GraphQL servers return null instead of [] for empty lists.
		stubFetchOk({ data: { findPendingContractUpdates: null } });

		const result = await loadPendingUpdates();

		expect(result.source).toBe('live');
		expect(result.updates).toEqual([]);
	});
});

describe('loadPendingUpdates — fallback paths', () => {
	it('falls back to mock when backend returns a GraphQL error (field not found)', async () => {
		// Today's reality on api.vsc.eco until PR #210 deploys.
		stubFetchOk({
			errors: [{ message: 'Cannot query field "findPendingContractUpdates" on type "Query".' }]
		});

		const result = await loadPendingUpdates();

		expect(result.source).toBe('mock');
		if (result.source !== 'mock') return;
		expect(result.reason).toMatch(/Cannot query field "findPendingContractUpdates"/);
		expect(result.updates.length).toBeGreaterThan(0); // mock fixtures
	});

	it('falls back to mock on HTTP 5xx', async () => {
		stubFetchHttp(503);
		const result = await loadPendingUpdates();
		expect(result.source).toBe('mock');
		if (result.source !== 'mock') return;
		expect(result.reason).toMatch(/HTTP 503/);
	});

	it('falls back to mock on HTTP 4xx', async () => {
		stubFetchHttp(404);
		const result = await loadPendingUpdates();
		expect(result.source).toBe('mock');
		if (result.source !== 'mock') return;
		expect(result.reason).toMatch(/HTTP 404/);
	});

	it('falls back to mock on network error (fetch throws)', async () => {
		stubFetchThrows(new Error('Network request failed'));
		const result = await loadPendingUpdates();
		expect(result.source).toBe('mock');
		if (result.source !== 'mock') return;
		expect(result.reason).toBe('Network request failed');
	});

	it('mock fallback still enriches known contracts with metadata', async () => {
		// Same enrichment contract as the live path — important so the
		// component renders consistently regardless of source.
		stubFetchThrows(new Error('boom'));
		const result = await loadPendingUpdates();
		expect(result.source).toBe('mock');
		const known = result.updates.find((u) => CONTRACT_REGISTRY[u.id] !== undefined);
		expect(known).toBeDefined();
		expect(known!.metadata).toBeDefined();
	});
});

// ─── loadUpdateById ───────────────────────────────────────────────────────

describe('loadUpdateById', () => {
	it('returns the matching update from a live response', async () => {
		stubFetchOk({
			data: {
				findPendingContractUpdates: [FIXTURE_KNOWN, FIXTURE_UNKNOWN]
			}
		});
		const found = await loadUpdateById('vsc1UnknownContractIdNotInRegistry');
		expect(found?.id).toBe('vsc1UnknownContractIdNotInRegistry');
		expect(found?.proposer).toBe('someuser');
	});

	it('returns undefined when the id is not in the result set', async () => {
		stubFetchOk({
			data: {
				findPendingContractUpdates: [FIXTURE_KNOWN]
			}
		});
		const found = await loadUpdateById('vsc1NotInList');
		expect(found).toBeUndefined();
	});

	it('finds a mock entry when backend is down', async () => {
		stubFetchThrows(new Error('offline'));
		// HIVE/HBD pool mock id from mockData.ts MOCK_PENDING_UPDATES[0].
		const found = await loadUpdateById('vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp');
		expect(found).toBeDefined();
		expect(found?.metadata?.name).toBe('Pool: HIVE / HBD');
	});
});

// ─── ISO timestamp parsing (used by the Countdown component) ──────────────

describe('tsToUnixSec — activation_ts parsing', () => {
	it('parses bare timestamps as UTC — exact value (live-verified format)', () => {
		// Live wire sample from the 2026-06-12 testnet contract-update test:
		// activation_ts arrives WITHOUT a timezone designator but IS UTC.
		// Naive Date.parse treats it as local time, which shifted the
		// activation by the user's UTC offset and made the countdown show
		// "unlocked" for a pending update. Pin the exact UTC epoch so a
		// regression can't sneak back regardless of the test runner's TZ.
		expect(tsToUnixSec('2026-06-12T14:08:45')).toBe(Date.parse('2026-06-12T14:08:45Z') / 1000);
	});

	it('parses ISO with Z suffix as well (defensive)', () => {
		const sec = tsToUnixSec('2026-06-08T12:34:56Z');
		expect(Number.isFinite(sec)).toBe(true);
		expect(sec).toBeGreaterThan(0);
	});
});
