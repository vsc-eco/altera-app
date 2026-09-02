/**
 * Notification feed — reconciles the bell against the chain.
 *
 * Three sources, each solving a reach/memory problem the pages can't:
 *
 *   - **Contract updates.** A scheduled update is only actionable inside its
 *     timelock; anyone who doesn't happen to open /witness-assistant during
 *     that window misses it. The bell is on every page. The feed also reports
 *     updates that activated while the app was closed, by replaying everything
 *     newer than a stored high-water mark ("since your last visit") — the
 *     witness page only ever knows what is pending *right now*.
 *   - **Governance proposals.** Witness-only: surfaced solely for accounts
 *     holding consensus stake, because nobody else's vote is accepted on chain.
 *   - **Your transactions.** Previously a notification was only written if you
 *     happened to be sitting on the transactions page when a row flipped
 *     status (see Tr.svelte), so in practice the bell stayed empty. Polling
 *     them here means a send that confirms — or fails — five minutes later, on
 *     another page or after a reload, still reaches you.
 *
 * The store is the source of truth for what has already been shown — rows live
 * in localStorage, so an unchanged row re-reported on the next poll is a no-op
 * (see `upsertNotification`) and only genuine transitions resurface as unread.
 */
import { get } from 'svelte/store';
import {
	FEED_LAST_SEEN_KEY,
	notificationKind,
	notifications,
	setLocalNotifications,
	upsertNotification,
	type ContractUpdateNotification,
	type GovernanceNotification,
	type TxNotification
} from './notifications';
import {
	fetchFeed,
	type FeedContractUpdate,
	type FeedProposal,
	type FeedTransaction
} from './notificationFeedSources';
import { getLocalTransactions } from '$lib/stores/localStorageTxs';

/** First run (or first after a logout): how far back to look. Long enough to
 *  be useful, short enough that the bell doesn't open onto a wall of history. */
const FIRST_RUN_BACKFILL_MS = 7 * 24 * 60 * 60 * 1000;

/** Ceiling on the replay window however stale the marker is — someone
 *  returning after six months wants the recent picture, not all of it. */
const MAX_BACKFILL_MS = 30 * 24 * 60 * 60 * 1000;

/** Settled rows are dropped once they age out. Live ones (a pending update, an
 *  open proposal, an unconfirmed tx) are kept however long they've been around. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Statuses that mean "still in flight" — always worth showing, whenever they
 *  started. PENDING is the client-side status for a broadcast we haven't seen
 *  come back from the chain yet (localStorageTxs). */
const LIVE_TX_STATUSES = new Set(['PENDING', 'UNCONFIRMED', 'INCLUDED']);

export const contractUpdateId = (contractId: string, code: string) =>
	`contract-update:${contractId}:${code}`;
export const governanceId = (proposalId: string) => `governance:${proposalId}`;

/** Match accounts the way the node does (governance.NormalizeAccount):
 *  lowercase, `hive:` prefix stripped. */
const normalizeAccount = (a: string) =>
	a
		.trim()
		.toLowerCase()
		.replace(/^hive:/, '');

/**
 * High-water marks, one per source.
 *
 * A single shared marker looked fine until the browser check: the first poll
 * after a page load runs before auth resolves, so it queries only the
 * chain-wide sources — and then advanced the marker to now, putting the
 * account's last week of transactions outside the window before they were ever
 * fetched. Each source therefore carries its own mark, advanced only on a poll
 * that actually queried it. Account-scoped marks are keyed by DID so switching
 * accounts backfills the new one instead of inheriting the old one's position.
 */
type Markers = Record<string, string>;

/** Chain-wide: contract updates are the same for every viewer. */
const CHAIN_MARK = 'chain';
const txMark = (did: string) => `tx:${did}`;
const govMark = (did: string) => `gov:${did}`;

/** Plenty for one person's accounts; keeps the entry from growing forever. */
const MAX_MARKS = 12;

function readMarkers(): Markers {
	try {
		const raw = globalThis.localStorage?.getItem?.(FEED_LAST_SEEN_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		// Pre-per-source marker: a bare ISO string, which was chain-wide.
		if (typeof parsed === 'string') return { [CHAIN_MARK]: parsed };
		if (parsed && typeof parsed === 'object') return parsed as Markers;
		return {};
	} catch {
		return {};
	}
}

function writeMarkers(marks: Markers) {
	try {
		const entries = Object.entries(marks);
		// Newest-first, so the oldest account marks are the ones dropped.
		const kept = entries.sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).slice(0, MAX_MARKS);
		globalThis.localStorage?.setItem?.(
			FEED_LAST_SEEN_KEY,
			JSON.stringify(Object.fromEntries(kept))
		);
	} catch {
		/* private mode / storage disabled — the feed still works, it just
		   re-derives the window from the first-run default every session. */
	}
}

/** Start of one source's replay window: its mark, floored at the max backfill. */
export function windowStartMs(key: string, nowMs: number, marks = readMarkers()): number {
	const ms = Date.parse(marks[key] ?? '');
	if (!Number.isFinite(ms)) return nowMs - FIRST_RUN_BACKFILL_MS;
	return Math.max(ms, nowMs - MAX_BACKFILL_MS);
}

function toContractNotification(u: FeedContractUpdate): ContractUpdateNotification {
	return {
		kind: 'contract-update',
		contractId: u.contractId,
		name: u.name,
		proposer: u.proposer,
		code: u.code,
		activationHeight: u.activationHeight,
		activationTs: new Date(u.activationSec * 1000).toISOString(),
		state: u.state,
		timestamp: new Date(u.eventSec * 1000).toISOString(),
		read: false
	};
}

function toGovernanceNotification(p: FeedProposal, username?: string): GovernanceNotification {
	const me = username ? normalizeAccount(username) : '';
	return {
		kind: 'governance',
		proposalId: p.proposalId,
		proposalType: p.proposalType,
		status: p.status,
		subject: p.subject,
		amount: p.amount,
		voted: !!me && p.voters.some((v) => normalizeAccount(v) === me),
		timestamp: new Date(p.eventSec * 1000).toISOString(),
		read: false
	};
}

/** Legacy `to`/`from` shape so rows written by Tr.svelte and by the feed —
 *  which share the tx id as their key — render identically. */
function toTxNotification(t: FeedTransaction): TxNotification {
	const base = {
		kind: 'tx' as const,
		type: t.type,
		status: t.status,
		opIndex: t.opIndex,
		amount: t.amount,
		asset: t.asset,
		timestamp: new Date(t.eventSec * 1000).toISOString(),
		read: false
	};
	return t.outgoing ? { ...base, to: t.counterparty } : { ...base, from: t.counterparty };
}

/**
 * Locally-broadcast transactions the chain hasn't returned yet. `fetchFeed`
 * can't see these — findTransaction only knows about txs the node has indexed —
 * so the "sending…" state would otherwise be invisible in the bell.
 * localStorageTxs drops these after 24h, and the on-chain row supersedes them
 * (same tx id, so it's the same notification).
 */
function localPendingTransactions(did: string): FeedTransaction[] {
	const out: FeedTransaction[] = [];
	let local: ReturnType<typeof getLocalTransactions> = [];
	try {
		local = getLocalTransactions();
	} catch {
		return out; // storage unavailable — the chain rows still come through
	}
	for (const tx of local) {
		if (!tx.isPending) continue;
		const ops = tx.ops ?? [];
		const mine = ops.some((op) => op?.data?.from === did || op?.data?.to === did);
		if (!mine) continue;
		const op = ops.find((o) => o?.data?.from === did) ?? ops[0];
		const data = (op?.data ?? {}) as { from?: string; to?: string };
		const outgoing = data.from === did;
		const ts = Date.parse(tx.first_seen?.endsWith('Z') ? tx.first_seen : `${tx.first_seen}Z`);
		out.push({
			txId: tx.id,
			type: op?.type || tx.type,
			status: 'PENDING',
			counterparty: (outgoing ? data.to : data.from) ?? '',
			outgoing,
			opIndex: op?.index ?? 0,
			eventSec: Number.isFinite(ts) ? Math.floor(ts / 1000) : Math.floor(Date.now() / 1000)
		});
	}
	return out;
}

/**
 * Drop feed rows that have aged out. Live rows — a still-timelocked update, a
 * still-open proposal, an in-flight tx — are exempt: they stay until the chain
 * settles them.
 */
function pruneExpired(nowMs: number): boolean {
	const ntfs = get(notifications);
	let changed = false;
	for (const [id, ntf] of [...ntfs.entries()]) {
		const kind = notificationKind(ntf);
		if (kind === 'contract-update' && (ntf as ContractUpdateNotification).state === 'pending')
			continue;
		if (kind === 'governance' && (ntf as GovernanceNotification).status === 'open') continue;
		if (kind === 'tx' && LIVE_TX_STATUSES.has((ntf as TxNotification).status)) continue;
		const ts = Date.parse(ntf.timestamp);
		if (Number.isFinite(ts) && nowMs - ts > RETENTION_MS) {
			ntfs.delete(id);
			changed = true;
		}
	}
	return changed;
}

export type SyncOptions = {
	/** Consensus-staked HIVE in base units. > 0 gates the governance section. */
	consensusStake: number;
	/** Signed-in account DID (`hive:name` / `did:pkh:…`); omitted when logged out. */
	did?: string;
	/** Signed-in Hive account name, used to mark proposals you already voted on. */
	username?: string;
	/** Injectable clock — tests pin it, callers don't pass it. */
	nowMs?: number;
};

export type SyncResult = { ok: boolean; added: number };

/**
 * Poll the chain once and reconcile the bell against it.
 *
 * Currently-live items (pending updates, open proposals, in-flight txs) are
 * always ingested — they're actionable regardless of when they appeared.
 * Settled items are ingested only if they're newer than the window start, or
 * if we already hold the row and are recording its transition (queued →
 * activated, open → applied, unconfirmed → confirmed), which resurfaces it as
 * unread.
 */
export async function syncNotificationFeed(opts: SyncOptions): Promise<SyncResult> {
	const nowMs = opts.nowMs ?? Date.now();
	const isWitness = opts.consensusStake > 0;
	const snapshot = await fetchFeed(
		{ includeGovernance: isWitness, did: opts.did },
		Math.floor(nowMs / 1000)
	);
	// A failed poll must not advance any mark, or the events it missed would
	// fall out of the window and never be reported.
	if (!snapshot.ok) return { ok: false, added: 0 };

	const marks = readMarkers();
	const known = get(notifications);
	let added = 0;
	/** Live now, or news since the last visit, or a row we're already tracking. */
	const worthShowing = (id: string, live: boolean, eventSec: number, start: number) =>
		live || eventSec * 1000 > start || known.has(id);

	const chainStart = windowStartMs(CHAIN_MARK, nowMs, marks);
	for (const u of snapshot.updates) {
		const id = contractUpdateId(u.contractId, u.code);
		if (!worthShowing(id, u.state === 'pending', u.eventSec, chainStart)) continue;
		if (upsertNotification(id, toContractNotification(u))) added++;
	}
	marks[CHAIN_MARK] = new Date(nowMs).toISOString();

	// Guarded here as well as at the query: a non-witness must never end up with
	// governance rows, whatever the source hands back.
	if (isWitness && opts.did) {
		const start = windowStartMs(govMark(opts.did), nowMs, marks);
		for (const p of snapshot.proposals) {
			const id = governanceId(p.proposalId);
			if (!worthShowing(id, p.status === 'open', p.eventSec, start)) continue;
			if (upsertNotification(id, toGovernanceNotification(p, opts.username))) added++;
		}
		marks[govMark(opts.did)] = new Date(nowMs).toISOString();
	}

	if (opts.did) {
		const start = windowStartMs(txMark(opts.did), nowMs, marks);
		// Chain rows last so they overwrite the local placeholder for the same id.
		const txs = [...localPendingTransactions(opts.did), ...snapshot.transactions];
		for (const t of txs) {
			if (!worthShowing(t.txId, LIVE_TX_STATUSES.has(t.status), t.eventSec, start)) continue;
			if (upsertNotification(t.txId, toTxNotification(t))) added++;
		}
		marks[txMark(opts.did)] = new Date(nowMs).toISOString();
	}

	if (pruneExpired(nowMs)) setLocalNotifications(get(notifications));
	writeMarkers(marks);
	return { ok: true, added };
}
