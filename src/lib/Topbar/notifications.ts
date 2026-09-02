import { get, writable } from 'svelte/store';

type ToNotification = {
	to: string;
	type: string;
	timestamp: string;
	read: boolean;
	status: string;
};

type FromNotification = {
	from: string;
	type: string;
	timestamp: string;
	read: boolean;
	status: string;
};

/** A transaction notification — the original (and still the only
 *  locally-generated) kind. Rows written before the feed landed have no `kind`
 *  field at all, so it stays optional and absence means 'tx'. The map key is
 *  the transaction id, shared with Tr.svelte's rows. */
export type TxNotification = (ToNotification | FromNotification) & {
	kind?: 'tx';
	/** Operation index, for the `?tx=&index=` deep link into the transactions
	 *  page. Absent on legacy rows, which fall back to 0. */
	opIndex?: number;
	/** Settled amount in smallest units, from the ledger. */
	amount?: number;
	/** Asset of `amount` (`hive`, `hbd`, …). */
	asset?: string;
};

/**
 * A contract update seen on chain — either still inside its timelock
 * ('pending') or already live ('activated'). Mirrors the witness page's
 * Contract-updates card, so witnesses get the audit window even when they
 * never open that page.
 */
export type ContractUpdateNotification = {
	kind: 'contract-update';
	/** Contract being updated (NOT a proposal id). */
	contractId: string;
	/** Friendly label (curated registry or on-chain `findContract.name`). */
	name?: string;
	/** Account that signed the update transaction. */
	proposer: string;
	/** IPFS CID of the new WASM code. */
	code: string;
	/** Block height at which the timelock unlocks. */
	activationHeight: number;
	/** ISO 8601 estimate of when the timelock unlocks — drives the
	 *  "activates in …" countdown on pending rows. */
	activationTs: string;
	/** 'pending' while timelocked, 'activated' once the head passed it. */
	state: 'pending' | 'activated';
	/** ISO 8601 — queued-at while pending, activated-at once live. */
	timestamp: string;
	read: boolean;
};

/**
 * A witness-vote governance proposal (reserve payout / slash restoration).
 * Only surfaced for accounts with consensus stake — everyone else can't vote,
 * so it would be noise.
 */
export type GovernanceNotification = {
	kind: 'governance';
	proposalId: string;
	/** 'reserve_payout' | 'slash_restore'. */
	proposalType: string;
	/** Lifecycle status: 'open' | 'applied' | 'expired'. */
	status: string;
	/** Payout recipient / restored account — the one-line summary subject. */
	subject: string;
	/** Amount in base units (HBD for payouts, HIVE bond for restorations). */
	amount: number;
	/** True when the signed-in account already cast its approval. */
	voted: boolean;
	/** ISO 8601 — created-at while open, applied/expired-at once settled. */
	timestamp: string;
	read: boolean;
};

export type Notification = TxNotification | ContractUpdateNotification | GovernanceNotification;

/** Discriminator that also covers legacy rows stored without a `kind`. */
export function notificationKind(ntf: Notification): 'tx' | 'contract-update' | 'governance' {
	return 'kind' in ntf && ntf.kind ? ntf.kind : 'tx';
}

/**
 * High-water mark for the notification feed (see $lib/Topbar/notificationFeed):
 * the last time we successfully ingested on-chain events. Lives here so
 * `clearNotifications` can drop it with the rest of the notification state —
 * otherwise a logout would wipe the rows but keep the marker, and the feed
 * would refuse to re-backfill them after the next login.
 */
export const FEED_LAST_SEEN_KEY = 'notification-feed-last-seen';

export const notifications = writable<Map<string, Notification>>(new Map());
export const notificationUpdateIndicator = writable<string>('');

/**
 * Bump the reactivity token. The store holds a Map that is mutated in place,
 * so subscribers key off this string instead. It carries a monotonic revision
 * as well as the id set: content-only changes (a queued update going live)
 * leave the ids identical and would otherwise be invisible to subscribers.
 */
let revision = 0;
function indicateUpdate() {
	let allIds = '';
	for (const id of get(notifications).keys()) {
		allIds += id;
	}
	notificationUpdateIndicator.set(`${++revision}:${allIds}`);
}

export function addNotification(id: string, tx: Notification) {
	const ntfs = get(notifications);
	if (ntfs.has(id)) return;
	get(notifications).set(id, tx);
	setLocalNotifications(get(notifications));
}

/** Everything except `read` — the fields that decide whether a stored row
 *  still says the same thing as the freshly-fetched one. */
function contentOf(ntf: Notification): string {
	const { read: _read, ...rest } = ntf;
	return JSON.stringify(rest, Object.keys(rest).sort());
}

/**
 * Insert a notification, or replace one whose content changed.
 *
 * Unlike `addNotification` this is idempotent for polled sources: re-reporting
 * an unchanged row is a no-op (no write, no unread flip), while a genuine
 * change — a contract update leaving its timelock, a proposal being applied —
 * resurfaces the row as unread so the user actually sees the transition.
 *
 * Returns true when the store changed.
 */
export function upsertNotification(id: string, next: Notification): boolean {
	const ntfs = get(notifications);
	const prev = ntfs.get(id);
	if (prev && contentOf(prev) === contentOf(next)) return false;
	ntfs.set(id, { ...next, read: false });
	setLocalNotifications(ntfs);
	return true;
}

export function getLocalNotifications(): Map<string, Notification> {
	const txString = localStorage.getItem('notifications');
	if (!txString) return new Map();
	const kvArray: [string, Notification][] = JSON.parse(txString);
	if (kvArray.some(([key, val]) => !key || !val)) {
		return new Map();
	}
	return new Map(kvArray);
}

export function setLocalNotifications(notifications: Map<string, Notification>) {
	localStorage.setItem('notifications', JSON.stringify(Array.from(notifications.entries())));
	indicateUpdate();
}

export function removeNotification(id: string) {
	get(notifications).delete(id);
	setLocalNotifications(get(notifications));
}

/**
 * Wipe all notifications (store + localStorage). Called on logout so a
 * different account signing in afterwards doesn't inherit the previous
 * user's notifications. Notifications are global (not DID-scoped), so the
 * single `notifications` key must be cleared with the rest of the account
 * state — see cleanUpLogout.
 */
export function clearNotifications() {
	notifications.set(new Map());
	localStorage.removeItem('notifications');
	localStorage.removeItem(FEED_LAST_SEEN_KEY);
	notificationUpdateIndicator.set('');
}
