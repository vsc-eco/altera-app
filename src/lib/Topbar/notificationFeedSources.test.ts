/**
 * Feed-source tests — pin the wire shape and the classification rules.
 *
 * Fixtures mirror what api.vsc.eco returns today (verified live 2026-09-01):
 * `findContract(historical: true)` yields every stored version newest-first,
 * with `activation_height > creation_height` marking a timelocked update and
 * equality marking an immediate deploy. If the backend ever changes that,
 * these fail loudly rather than the bell silently reporting deploys as
 * updates — or missing updates entirely.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyTransaction, fetchFeed } from './notificationFeedSources';

const HEAD = 109_600_000;

/** Queued update: still inside its timelock (activation above the head). */
const PENDING_UPDATE = {
	id: 'vsc1BisggC1NtviuYN1mSR372HGSU6hUfdZARt',
	name: 'Lumen Creator        Tokens', // free-text on-chain name, as on mainnet
	code: 'bafkreiajgng3ozcazro5goha34f2yfs265iylzi6rr5pk6ttent7s5xocu',
	proposer: 'hive:lumencontracts',
	owner: 'hive:lumencontracts',
	creation_height: 109_541_379,
	creation_ts: '2026-09-01T19:02:06',
	activation_height: 109_698_979,
	activation_ts: '2026-09-06T19:02:06'
};

/** Update whose timelock already expired — the "you missed it" case. */
const ACTIVATED_UPDATE = {
	id: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45',
	name: 'DEX Router',
	code: 'bafkreiactivatedcid',
	proposer: 'hive:vsc.dao',
	owner: 'hive:vsc.dao',
	creation_height: 107_728_767,
	creation_ts: '2026-07-02T15:54:54',
	activation_height: 107_786_367,
	activation_ts: '2026-07-03T15:54:54'
};

/** A plain deploy: activation == creation, so never an "update". */
const DEPLOY = {
	id: 'vsc1BV7EjeGGNCkA1yJ1iv2gzGkDjFGFwXv9Hi',
	name: 'LasseCash',
	code: 'bafkreideploycid',
	proposer: 'hive:lassecashmagi',
	owner: 'hive:lassecashmagi',
	creation_height: 109_537_220,
	creation_ts: '2026-09-01T15:33:36',
	activation_height: 109_537_220,
	activation_ts: '2026-09-01T15:33:36'
};

const PROPOSAL = {
	proposalId: 'reserve_payout:10e0681826d8aeab',
	type: 'reserve_payout',
	status: 'open',
	creationBlock: HEAD - 1200, // 1200 blocks * 3s = 1h ago
	appliedBlock: 0,
	amount: 200_000,
	recipient: 'emrebeyler.vsc',
	slashedAccount: '',
	beneficiary: 'emrebeyler.vsc',
	votes: [{ voter: 'tibfox.vsc' }, { voter: 'milo.vsc' }]
};

let lastBody = '';

function stubFetch(data: unknown) {
	const mock = vi.fn().mockImplementation((_url: string, init: { body: string }) => {
		lastBody = init.body;
		return Promise.resolve({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ data })
		});
	});
	vi.stubGlobal('fetch', mock);
	return mock;
}

const fullData = (overrides: Record<string, unknown> = {}) => ({
	head: { last_processed_block: HEAD },
	pending: [PENDING_UPDATE],
	history: [PENDING_UPDATE, ACTIVATED_UPDATE, DEPLOY],
	governance: [PROPOSAL],
	...overrides
});

afterEach(() => {
	vi.unstubAllGlobals();
	lastBody = '';
});

describe('contract update classification', () => {
	it('reports queued updates as pending and expired ones as activated', async () => {
		stubFetch(fullData());
		const snap = await fetchFeed({ includeGovernance: false });
		expect(snap.ok).toBe(true);
		const byId = Object.fromEntries(snap.updates.map((u) => [u.contractId, u]));
		expect(byId[PENDING_UPDATE.id].state).toBe('pending');
		// Runs of whitespace in on-chain names are collapsed for display.
		expect(byId[PENDING_UPDATE.id].name).toBe('Lumen Creator Tokens');
		expect(byId[ACTIVATED_UPDATE.id].state).toBe('activated');
	});

	it('never reports a deploy as an update', async () => {
		stubFetch(fullData());
		const snap = await fetchFeed({ includeGovernance: false });
		expect(snap.updates.map((u) => u.contractId)).not.toContain(DEPLOY.id);
	});

	it('dates a pending update by when it was queued, an activated one by go-live', async () => {
		stubFetch(fullData());
		const snap = await fetchFeed({ includeGovernance: false });
		const pending = snap.updates.find((u) => u.contractId === PENDING_UPDATE.id)!;
		const activated = snap.updates.find((u) => u.contractId === ACTIVATED_UPDATE.id)!;
		// Bare timestamps from the node are UTC, not local (see tsToUnixSec).
		expect(pending.eventSec).toBe(Date.parse(PENDING_UPDATE.creation_ts + 'Z') / 1000);
		expect(activated.eventSec).toBe(Date.parse(ACTIVATED_UPDATE.activation_ts + 'Z') / 1000);
		expect(pending.activationSec).toBe(Date.parse(PENDING_UPDATE.activation_ts + 'Z') / 1000);
	});

	it('does not duplicate an update that appears in both pending and history', async () => {
		stubFetch(fullData());
		const snap = await fetchFeed({ includeGovernance: false });
		expect(snap.updates.filter((u) => u.contractId === PENDING_UPDATE.id)).toHaveLength(1);
	});
});

describe('governance', () => {
	it('is not requested at all for non-witnesses', async () => {
		stubFetch(fullData());
		const snap = await fetchFeed({ includeGovernance: false });
		expect(lastBody).not.toContain('findGovernanceProposals');
		expect(snap.proposals).toEqual([]);
	});

	it('dates proposals from block heights against the head', async () => {
		stubFetch(fullData());
		const nowSec = 1_800_000_000;
		const snap = await fetchFeed({ includeGovernance: true }, nowSec);
		expect(lastBody).toContain('findGovernanceProposals');
		const p = snap.proposals[0];
		expect(p.eventSec).toBe(nowSec - 1200 * 3);
		expect(p.subject).toBe('emrebeyler.vsc');
		expect(p.voters).toEqual(['tibfox.vsc', 'milo.vsc']);
	});
});

describe('transactions', () => {
	it('is not requested when logged out', async () => {
		stubFetch(fullData());
		const snap = await fetchFeed({ includeGovernance: false });
		expect(lastBody).not.toContain('findTransaction');
		expect(snap.transactions).toEqual([]);
	});

	it('queries BOTH filters, because neither is a superset of the other', async () => {
		stubFetch(fullData({ txs: [], txsLedger: [] }));
		await fetchFeed({ includeGovernance: false, did: 'hive:tibfox' });
		expect(lastBody).toContain('byAccount: \\"hive:tibfox\\"');
		expect(lastBody).toContain('byLedgerToFrom: \\"hive:tibfox\\"');
	});

	it('merges the two result sets and deduplicates by tx id', async () => {
		const shared = {
			id: 'tx-shared',
			status: 'CONFIRMED',
			type: 'hive',
			anchr_ts: '2026-09-01T12:00:00',
			first_seen: null,
			ops: [{ type: 'transfer', index: 0, data: { from: 'hive:tibfox', to: 'hive:milo' } }],
			ledger: []
		};
		stubFetch(
			fullData({ txs: [shared], txsLedger: [shared, { ...shared, id: 'tx-ledger-only' }] })
		);
		const snap = await fetchFeed({ includeGovernance: false, did: 'hive:tibfox' });
		expect(snap.transactions.map((t) => t.txId)).toEqual(['tx-shared', 'tx-ledger-only']);
	});

	it('names the counterparty from the ledger when the ops never mention us', () => {
		// Real mainnet shape: someone else calls execute_lottery, and the only
		// place our account appears is the settled payout.
		const tx = classifyTransaction(
			{
				id: 'tx-lottery',
				status: 'CONFIRMED',
				type: 'hive',
				anchr_ts: '2026-06-30T18:06:57',
				first_seen: null,
				ops: [
					{
						type: 'call',
						index: 0,
						data: {
							action: 'execute_lottery',
							contract_id: 'vsc1BiM4NC1yeGPCjmq8FC3utX8dByizjcCBk7'
						}
					}
				],
				ledger: [
					{
						from: 'contract:vsc1BiM4NC1yeGPCjmq8FC3utX8dByizjcCBk7',
						to: 'hive:condeas',
						amount: 18240,
						asset: 'hive',
						type: 'transfer'
					},
					{
						from: 'contract:vsc1BiM4NC1yeGPCjmq8FC3utX8dByizjcCBk7',
						to: 'hive:tibfox',
						amount: 6080,
						asset: 'hive',
						type: 'transfer'
					}
				]
			},
			'hive:tibfox'
		);
		expect(tx.counterparty).toBe('contract:vsc1BiM4NC1yeGPCjmq8FC3utX8dByizjcCBk7');
		expect(tx.outgoing).toBe(false);
		expect(tx.amount).toBe(6080);
		expect(tx.asset).toBe('hive');
	});

	it('takes the amount from the ledger, in smallest units', () => {
		const tx = classifyTransaction(
			{
				id: 'tx6',
				status: 'CONFIRMED',
				type: 'hive',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				// The op payload carries a decimal string; the ledger carries the
				// settled integer, so that is what we report.
				ops: [
					{
						type: 'transfer',
						index: 0,
						data: { from: 'hive:tibfox', to: 'hive:milo', amount: '0.001' }
					}
				],
				ledger: [
					{ from: 'hive:tibfox', to: 'hive:milo', amount: 1, asset: 'hbd', type: 'transfer' }
				]
			},
			'hive:tibfox'
		);
		expect(tx.amount).toBe(1);
		expect(tx.asset).toBe('hbd');
		expect(tx.outgoing).toBe(true);
	});

	it('reports no amount for a failed tx — nothing moved', () => {
		const tx = classifyTransaction(
			{
				id: 'tx7',
				status: 'FAILED',
				type: 'hive',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				ops: [{ type: 'transfer', index: 0, data: { from: 'hive:tibfox', to: 'hive:milo' } }],
				ledger: [
					{ from: 'hive:tibfox', to: 'hive:milo', amount: 1, asset: 'hbd', type: 'transfer' }
				]
			},
			'hive:tibfox'
		);
		expect(tx.amount).toBeUndefined();
	});

	it('keeps a self-move counterparty-free but still reports its amount', () => {
		const tx = classifyTransaction(
			{
				id: 'tx8',
				status: 'CONFIRMED',
				type: 'hive',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				ops: [{ type: 'withdraw', index: 0, data: { from: 'hive:tibfox', to: 'hive:tibfox' } }],
				ledger: [
					{ from: 'hive:tibfox', to: 'hive:tibfox', amount: 129, asset: 'hbd', type: 'withdraw' }
				]
			},
			'hive:tibfox'
		);
		expect(tx.counterparty).toBe('');
		expect(tx.amount).toBe(129);
	});

	it('carries the operation index for the transactions-page deep link', () => {
		const tx = classifyTransaction(
			{
				id: 'tx9',
				status: 'CONFIRMED',
				type: 'hive',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				ops: [
					{ type: 'call', index: 0, data: { contract_id: 'vsc1B' } },
					{ type: 'transfer', index: 1, data: { from: 'hive:tibfox', to: 'hive:milo' } }
				],
				ledger: []
			},
			'hive:tibfox'
		);
		expect(tx.opIndex).toBe(1);
	});

	it('reads direction and counterparty off the first matching op', () => {
		const outgoing = classifyTransaction(
			{
				id: 'tx1',
				status: 'CONFIRMED',
				type: 'call_contract',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				ops: [{ type: 'transfer', data: { from: 'hive:tibfox', to: 'hive:milo' } }]
			},
			'hive:tibfox'
		);
		expect(outgoing).toMatchObject({ outgoing: true, counterparty: 'hive:milo', type: 'transfer' });

		const incoming = classifyTransaction(
			{
				id: 'tx2',
				status: 'FAILED',
				type: 'transfer',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				ops: [{ type: 'transfer', data: { from: 'hive:milo', to: 'hive:tibfox' } }]
			},
			'hive:tibfox'
		);
		expect(incoming).toMatchObject({ outgoing: false, counterparty: 'hive:milo' });
	});

	it('omits the counterparty when an op only names the account itself', () => {
		// Withdrawals are recorded with from == to; "Withdraw to @yourself" is noise.
		const tx = classifyTransaction(
			{
				id: 'tx5',
				status: 'CONFIRMED',
				type: 'hive',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				ops: [{ type: 'withdraw', data: { from: 'hive:tibfox', to: 'hive:tibfox' } }]
			},
			'hive:tibfox'
		);
		expect(tx.counterparty).toBe('');
		expect(tx.type).toBe('withdraw');
	});

	it('still reports ops without a counterparty (contract calls)', () => {
		const tx = classifyTransaction(
			{
				id: 'tx3',
				status: 'CONFIRMED',
				type: 'call_contract',
				anchr_ts: '2026-09-01T12:00:00',
				first_seen: null,
				ops: [{ type: 'call_contract', data: { contract_id: 'vsc1B…' } }]
			},
			'hive:tibfox'
		);
		expect(tx.counterparty).toBe('');
		expect(tx.type).toBe('call_contract');
	});

	it('falls back to first_seen when the tx has no anchor time', () => {
		const tx = classifyTransaction(
			{
				id: 'tx4',
				status: 'UNCONFIRMED',
				type: 'transfer',
				anchr_ts: null,
				first_seen: '2026-09-01T12:00:00',
				ops: []
			},
			'hive:tibfox'
		);
		expect(tx.eventSec).toBe(Date.parse('2026-09-01T12:00:00Z') / 1000);
	});
});

describe('failure handling', () => {
	it('reports not-ok (never empty-but-fine) on a GraphQL error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 422,
				json: () => Promise.resolve({ errors: [{ message: 'Cannot query field "history"' }] })
			})
		);
		const snap = await fetchFeed({ includeGovernance: true, did: 'hive:tibfox' });
		expect(snap.ok).toBe(false);
		expect(snap.updates).toEqual([]);
	});

	it('reports not-ok when the transport throws', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		const snap = await fetchFeed({ includeGovernance: false });
		expect(snap.ok).toBe(false);
	});
});
