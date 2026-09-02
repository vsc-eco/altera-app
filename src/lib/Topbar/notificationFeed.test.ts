/**
 * Sync-engine tests.
 *
 * The two behaviors worth protecting:
 *   - live items (pending update / open proposal / in-flight tx) always show,
 *     whenever they appeared;
 *   - settled items show only if they are news since the last visit — which is
 *     what makes "a contract update activated while you were away" work at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('./notificationFeedSources', () => ({
	fetchFeed: vi.fn()
}));
// The real module pulls in the whole transactions store graph; the bell only
// needs the locally-broadcast pending list, which we drive directly here.
vi.mock('$lib/stores/localStorageTxs', () => ({
	getLocalTransactions: vi.fn(() => [])
}));

import { fetchFeed } from './notificationFeedSources';
import { getLocalTransactions } from '$lib/stores/localStorageTxs';
import { contractUpdateId, governanceId, syncNotificationFeed } from './notificationFeed';
import {
	FEED_LAST_SEEN_KEY,
	clearNotifications,
	notifications,
	type ContractUpdateNotification,
	type GovernanceNotification,
	type TxNotification
} from './notifications';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-09-01T12:00:00Z');
const sec = (ms: number) => Math.floor(ms / 1000);
const DID = 'hive:tibfox';

/** Seed one source's high-water mark. */
function setMark(key: string, ms: number) {
	const raw = storage.get(FEED_LAST_SEEN_KEY);
	const marks = raw ? JSON.parse(raw) : {};
	marks[key] = new Date(ms).toISOString();
	storage.set(FEED_LAST_SEEN_KEY, JSON.stringify(marks));
}
const getMark = (key: string) =>
	JSON.parse(storage.get(FEED_LAST_SEEN_KEY) ?? '{}')[key] as string | undefined;

/** Minimal in-memory Storage — the node test env has none. */
function installStorage() {
	const map = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear()
	});
	return map;
}

const pendingUpdate = (overrides = {}) => ({
	contractId: 'vsc1Bpending',
	name: 'DEX Router',
	proposer: 'hive:vsc.dao',
	code: 'bafkreipending',
	activationHeight: 109_698_979,
	activationSec: sec(NOW + 2 * DAY),
	state: 'pending' as const,
	eventSec: sec(NOW - 30 * DAY), // queued long before any plausible window
	...overrides
});

const activatedUpdate = (eventMs: number, overrides = {}) => ({
	contractId: 'vsc1Bactivated',
	name: 'Pool: HIVE / HBD',
	proposer: 'hive:vsc.dao',
	code: 'bafkreiactivated',
	activationHeight: 109_000_000,
	activationSec: sec(eventMs),
	state: 'activated' as const,
	eventSec: sec(eventMs),
	...overrides
});

const proposal = (overrides = {}) => ({
	proposalId: 'reserve_payout:abc',
	proposalType: 'reserve_payout',
	status: 'open',
	subject: 'emrebeyler.vsc',
	amount: 200_000,
	voters: ['milo.vsc'],
	eventSec: sec(NOW - HOUR),
	...overrides
});

const tx = (overrides = {}) => ({
	txId: 'tx-abc',
	type: 'transfer',
	status: 'CONFIRMED',
	counterparty: 'hive:milo',
	outgoing: true,
	eventSec: sec(NOW - HOUR),
	...overrides
});

function snapshot(over: Partial<Parameters<typeof mockFeed>[0]> = {}) {
	return { updates: [], proposals: [], transactions: [], ok: true, ...over };
}

function mockFeed(snap: {
	updates?: unknown[];
	proposals?: unknown[];
	transactions?: unknown[];
	ok?: boolean;
}) {
	vi.mocked(fetchFeed).mockResolvedValue(
		snapshot(snap) as unknown as Awaited<ReturnType<typeof fetchFeed>>
	);
}

let storage: Map<string, string>;

beforeEach(() => {
	storage = installStorage();
	clearNotifications();
	vi.mocked(getLocalTransactions).mockReturnValue([]);
});

describe('replay window', () => {
	it('backfills a week on first run, so a fresh browser is not empty', async () => {
		mockFeed({ updates: [activatedUpdate(NOW - 2 * DAY)] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(get(notifications).size).toBe(1);
	});

	it('ignores settled events older than the first-run backfill', async () => {
		mockFeed({ updates: [activatedUpdate(NOW - 20 * DAY)] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(get(notifications).size).toBe(0);
	});

	it('reports an update that activated while the app was closed', async () => {
		// Last visit three days ago; the update went live two days ago.
		setMark('chain', NOW - 3 * DAY);
		mockFeed({ updates: [activatedUpdate(NOW - 2 * DAY)] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		const row = [...get(notifications).values()][0] as ContractUpdateNotification;
		expect(row.state).toBe('activated');
		expect(row.read).toBe(false);
	});

	it('does not re-add a settled event once the marker moved past it', async () => {
		setMark('chain', NOW - 3 * DAY);
		mockFeed({ updates: [activatedUpdate(NOW - 2 * DAY)] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		clearNotifications(); // stands in for the user deleting the row…
		setMark('chain', NOW); // …the mark survives
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW + HOUR });
		expect(get(notifications).size).toBe(0);
	});

	it('leaves the marks alone when the poll failed', async () => {
		setMark('chain', NOW - 3 * DAY);
		mockFeed({ ok: false });
		const res = await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(res.ok).toBe(false);
		expect(getMark('chain')).toBe(new Date(NOW - 3 * DAY).toISOString());
	});

	it('still honours a pre-per-source marker stored as a bare timestamp', async () => {
		storage.set(FEED_LAST_SEEN_KEY, new Date(NOW - 3 * DAY).toISOString());
		mockFeed({ updates: [activatedUpdate(NOW - 2 * DAY)] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(get(notifications).size).toBe(1);
	});

	it('keeps a separate mark per source, so a logged-out poll cannot skip the account backfill', async () => {
		// Regression (caught in the browser): the first poll of a page load runs
		// before auth resolves, so it queries only the chain-wide sources. With a
		// single shared marker it still advanced the window to now, and the
		// account's recent transactions were never backfilled.
		mockFeed({ updates: [] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(getMark('chain')).toBeDefined();
		expect(getMark(`tx:${DID}`)).toBeUndefined();

		mockFeed({ transactions: [tx({ eventSec: sec(NOW - 2 * DAY) })] });
		await syncNotificationFeed({ consensusStake: 0, did: DID, nowMs: NOW + 1000 });
		expect(get(notifications).get('tx-abc')).toBeDefined();
	});

	it('gives a newly signed-in account its own backfill window', async () => {
		mockFeed({ transactions: [tx({ eventSec: sec(NOW - 2 * DAY) })] });
		await syncNotificationFeed({ consensusStake: 0, did: DID, nowMs: NOW });
		expect(getMark(`tx:${DID}`)).toBeDefined();
		clearNotifications();

		// A different account starts fresh rather than inheriting the first one's
		// position, so its own recent history still comes through.
		mockFeed({ transactions: [tx({ txId: 'tx-other', eventSec: sec(NOW - 2 * DAY) })] });
		await syncNotificationFeed({ consensusStake: 0, did: 'hive:someone-else', nowMs: NOW + 1000 });
		expect(get(notifications).get('tx-other')).toBeDefined();
	});
});

describe('live items', () => {
	it('shows a pending contract update however long ago it was queued', async () => {
		setMark('chain', NOW);
		mockFeed({ updates: [pendingUpdate()] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(get(notifications).size).toBe(1);
	});

	it('resurfaces a pending update as unread when it goes live', async () => {
		mockFeed({ updates: [pendingUpdate()] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		const id = contractUpdateId('vsc1Bpending', 'bafkreipending');
		get(notifications).get(id)!.read = true;

		mockFeed({
			updates: [pendingUpdate({ state: 'activated', eventSec: sec(NOW), activationSec: sec(NOW) })]
		});
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW + HOUR });
		const row = get(notifications).get(id) as ContractUpdateNotification;
		expect(row.state).toBe('activated');
		expect(row.read).toBe(false);
	});

	it('does not touch an unchanged row on the next poll', async () => {
		mockFeed({ updates: [pendingUpdate()] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		const id = contractUpdateId('vsc1Bpending', 'bafkreipending');
		get(notifications).get(id)!.read = true;

		const res = await syncNotificationFeed({ consensusStake: 0, nowMs: NOW + HOUR });
		expect(res.added).toBe(0);
		expect(get(notifications).get(id)!.read).toBe(true);
	});
});

describe('governance', () => {
	it('is skipped entirely without consensus stake', async () => {
		mockFeed({ proposals: [proposal()] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(vi.mocked(fetchFeed).mock.lastCall![0].includeGovernance).toBe(false);
		expect(get(notifications).size).toBe(0);
	});

	it('is requested for witnesses and marks proposals you already voted on', async () => {
		mockFeed({ proposals: [proposal({ voters: ['milo.vsc', 'hive:TibFox.vsc'] })] });
		await syncNotificationFeed({
			consensusStake: 2_000_000,
			did: DID,
			username: 'tibfox.vsc',
			nowMs: NOW
		});
		expect(vi.mocked(fetchFeed).mock.lastCall![0].includeGovernance).toBe(true);
		const row = get(notifications).get(
			governanceId('reserve_payout:abc')
		) as GovernanceNotification;
		expect(row.voted).toBe(true);
	});

	it('flags an open proposal you have not voted on', async () => {
		mockFeed({ proposals: [proposal()] });
		await syncNotificationFeed({
			consensusStake: 2_000_000,
			did: DID,
			username: 'tibfox.vsc',
			nowMs: NOW
		});
		const row = get(notifications).get(
			governanceId('reserve_payout:abc')
		) as GovernanceNotification;
		expect(row.voted).toBe(false);
		expect(row.status).toBe('open');
	});
});

describe('transactions', () => {
	it('is skipped when logged out', async () => {
		mockFeed({ transactions: [tx()] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(vi.mocked(fetchFeed).mock.lastCall![0].did).toBeUndefined();
		expect(get(notifications).size).toBe(0);
	});

	it('records the account own transactions under the tx id', async () => {
		mockFeed({ transactions: [tx()] });
		await syncNotificationFeed({ consensusStake: 0, did: DID, nowMs: NOW });
		const row = get(notifications).get('tx-abc')!;
		expect(row).toMatchObject({ status: 'CONFIRMED', to: 'hive:milo', type: 'transfer' });
	});

	it('resurfaces a transaction when it settles', async () => {
		mockFeed({ transactions: [tx({ status: 'UNCONFIRMED' })] });
		await syncNotificationFeed({ consensusStake: 0, did: DID, nowMs: NOW });
		get(notifications).get('tx-abc')!.read = true;

		mockFeed({ transactions: [tx({ status: 'FAILED' })] });
		await syncNotificationFeed({ consensusStake: 0, did: DID, nowMs: NOW + HOUR });
		const row = get(notifications).get('tx-abc') as TxNotification;
		expect(row.status).toBe('FAILED');
		expect(row.read).toBe(false);
	});

	it('shows a locally-broadcast tx the chain has not indexed yet', async () => {
		vi.mocked(getLocalTransactions).mockReturnValue([
			{
				id: 'tx-local',
				isPending: true,
				first_seen: '2026-09-01T11:59:00',
				type: 'transfer',
				ops: [{ type: 'transfer', data: { from: 'hive:tibfox', to: 'hive:milo' } }]
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		] as any);
		mockFeed({ transactions: [] });
		await syncNotificationFeed({ consensusStake: 0, did: DID, nowMs: NOW });
		expect(get(notifications).get('tx-local')).toMatchObject({
			status: 'PENDING',
			to: 'hive:milo'
		});
	});

	it('lets the indexed row supersede the local placeholder for the same tx', async () => {
		vi.mocked(getLocalTransactions).mockReturnValue([
			{
				id: 'tx-abc',
				isPending: true,
				first_seen: '2026-09-01T11:59:00',
				type: 'transfer',
				ops: [{ type: 'transfer', data: { from: 'hive:tibfox', to: 'hive:milo' } }]
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		] as any);
		mockFeed({ transactions: [tx({ status: 'CONFIRMED' })] });
		await syncNotificationFeed({ consensusStake: 0, did: DID, nowMs: NOW });
		expect(get(notifications).size).toBe(1);
		expect((get(notifications).get('tx-abc') as TxNotification).status).toBe('CONFIRMED');
	});
});

describe('retention', () => {
	it('drops settled rows past the retention window but keeps live ones', async () => {
		setMark('chain', NOW - 40 * DAY);
		mockFeed({ updates: [pendingUpdate(), activatedUpdate(NOW - 25 * DAY)] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW });
		expect(get(notifications).size).toBe(2);

		// Ten days later the activated row is 35 days old; the pending one is
		// still pending, so it stays regardless of age.
		mockFeed({ updates: [pendingUpdate()] });
		await syncNotificationFeed({ consensusStake: 0, nowMs: NOW + 10 * DAY });
		const kinds = [...get(notifications).values()].map(
			(n) => (n as ContractUpdateNotification).state
		);
		expect(kinds).toEqual(['pending']);
	});
});
