/**
 * Transactions-page filter model + pure client-side filter function.
 *
 * Design (hybrid filtering):
 *   - CLIENT-SIDE filtering over the merged `allTransactionsStore` list is
 *     the SOURCE OF TRUTH for what's displayed. It must be, because the
 *     merged list contains items the server never filtered: localStorage
 *     pending txs and BTC-deposit indexer events.
 *   - SERVER-SIDE filter options (TransactionFilter.byType /
 *     byLedgerToFrom) are threaded into the GraphQL fetch as a PAGINATION
 *     OPTIMIZATION: when a type/address filter is active, pages fetched
 *     from the server contain mostly-matching rows so infinite scroll
 *     stays useful. The client filter then re-verifies everything.
 *
 * Pure functions only — no stores, no DOM — so the whole matrix is
 * unit-testable (see filters.test.ts).
 */
import type { TxListItem } from '$lib/stores/txStores';
import { getTimestamp } from '$lib/stores/txStores';

// ─── Filter state ────────────────────────────────────────────────────────────

export type TimeRangePreset = 'all' | '24h' | '7d' | '30d';

export type TxFilters = {
	/** Lowercase asset values to keep (e.g. ['hive', 'hbd']). Empty = all. */
	tokens: string[];
	/** Time window preset. 'all' = no time filtering. */
	timeRange: TimeRangePreset;
	/** Minimum amount in HUMAN units of the entry's own asset. null = no floor. */
	amountMin: number | null;
	/** Maximum amount in HUMAN units of the entry's own asset. null = no cap. */
	amountMax: number | null;
	/** Op/ledger types to keep (e.g. ['transfer', 'deposit']). Empty = all. */
	types: string[];
	/** Case-insensitive substring matched against from/to accounts. '' = all. */
	address: string;
};

export const EMPTY_FILTERS: TxFilters = {
	tokens: [],
	timeRange: 'all',
	amountMin: null,
	amountMax: null,
	types: [],
	address: ''
};

export function isFiltering(f: TxFilters): boolean {
	return (
		f.tokens.length > 0 ||
		f.timeRange !== 'all' ||
		f.amountMin != null ||
		f.amountMax != null ||
		f.types.length > 0 ||
		f.address.trim() !== ''
	);
}

/** Count of active filter groups — drives the "Filters (2)" chip label. */
export function activeFilterCount(f: TxFilters): number {
	let n = 0;
	if (f.tokens.length > 0) n++;
	if (f.timeRange !== 'all') n++;
	if (f.amountMin != null || f.amountMax != null) n++;
	if (f.types.length > 0) n++;
	if (f.address.trim() !== '') n++;
	return n;
}

// ─── Options the UI offers ───────────────────────────────────────────────────

/** Assets the filter chips offer. Lowercase values matching ledger `asset`
 *  fields (which sometimes carry suffixes like "hbd_savings" — matching is
 *  done on the prefix before '_'). */
export const TOKEN_OPTIONS = [
	{ value: 'hive', label: 'HIVE' },
	{ value: 'hbd', label: 'HBD' },
	{ value: 'btc', label: 'BTC' }
] as const;

/** Operation/ledger types the filter offers. Values match both
 *  `ledger[].type` and `ops[].type` (the client filter checks both). */
export const TYPE_OPTIONS = [
	{ value: 'transfer', label: 'Transfer' },
	{ value: 'deposit', label: 'Deposit' },
	{ value: 'withdraw', label: 'Withdraw' },
	{ value: 'stake', label: 'Stake' },
	{ value: 'unstake', label: 'Unstake' },
	{ value: 'call', label: 'Contract call' }
] as const;

export const TIME_RANGE_OPTIONS: { value: TimeRangePreset; label: string }[] = [
	{ value: 'all', label: 'All time' },
	{ value: '24h', label: 'Last 24 hours' },
	{ value: '7d', label: 'Last 7 days' },
	{ value: '30d', label: 'Last 30 days' }
];

// ─── Internals ───────────────────────────────────────────────────────────────

const TIME_RANGE_MS: Record<Exclude<TimeRangePreset, 'all'>, number> = {
	'24h': 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000,
	'30d': 30 * 24 * 60 * 60 * 1000
};

/** Decimal places per asset for converting smallest units → human units. */
const ASSET_DECIMALS: Record<string, number> = {
	hive: 3,
	hbd: 3,
	btc: 8,
	sats: 0
};

/** "hbd_savings" → "hbd"; "HIVE" → "hive". */
function normalizeAsset(raw: unknown): string {
	return String(raw ?? '')
		.toLowerCase()
		.split('_')[0];
}

function toHumanAmount(raw: unknown, asset: string): number | null {
	const dp = ASSET_DECIMALS[asset];
	if (dp === undefined) return null;
	if (typeof raw === 'number') return raw / 10 ** dp;
	if (typeof raw === 'string') {
		const n = Number(raw);
		if (!Number.isFinite(n)) return null;
		// Strings with a decimal point are already human units (Hive L1 ops
		// e.g. "5.453"); integer strings are smallest units.
		return raw.includes('.') ? n : n / 10 ** dp;
	}
	return null;
}

/** Every (asset, amount, from, to, type) tuple found on a tx — from both
 *  ledger entries and op payloads. A tx matches a filter if ANY entry does. */
type TxEntry = {
	asset: string;
	amountHuman: number | null;
	from: string;
	to: string;
	type: string;
};

function entriesOf(item: TxListItem): TxEntry[] {
	if (item.kind === 'btc-deposit') {
		return [
			{
				asset: 'btc',
				amountHuman: toHumanAmount(item.event.amount, 'btc'),
				from: item.event.sender ?? '',
				to: item.event.recipient ?? '',
				type: 'deposit'
			}
		];
	}
	const out: TxEntry[] = [];
	for (const entry of item.tx.ledger ?? []) {
		if (!entry) continue;
		const asset = normalizeAsset(entry.asset);
		out.push({
			asset,
			amountHuman: toHumanAmount(entry.amount, asset),
			from: entry.from ?? '',
			to: entry.to ?? '',
			type: String(entry.type ?? '')
		});
	}
	for (const op of item.tx.ops ?? []) {
		if (!op) continue;
		const data = op.data ?? {};
		const asset = normalizeAsset(data.asset);
		out.push({
			asset,
			amountHuman: toHumanAmount(data.amount, asset),
			from: String(data.from ?? ''),
			to: String(data.to ?? ''),
			type: String(op.type ?? '')
		});
	}
	return out;
}

export function itemTimestampMs(item: TxListItem): number {
	if (item.kind === 'btc-deposit') {
		const ts = item.event.indexer_ts;
		return new Date(ts.endsWith('Z') ? ts : ts + 'Z').getTime();
	}
	return new Date(getTimestamp(item.tx)).getTime();
}

// ─── The filter ──────────────────────────────────────────────────────────────

/**
 * Apply all active filters to the merged tx list. An item passes when EVERY
 * active filter group matches at least one of its entries (token, amount,
 * type, address) and its timestamp falls inside the window.
 *
 * @param nowMs  Injected clock for testability (defaults to Date.now()).
 */
export function applyClientFilters(
	items: TxListItem[],
	filters: TxFilters,
	nowMs: number = Date.now()
): TxListItem[] {
	if (!isFiltering(filters)) return items;

	const address = filters.address.trim().toLowerCase();
	const cutoffMs =
		filters.timeRange === 'all' ? null : nowMs - TIME_RANGE_MS[filters.timeRange];

	return items.filter((item) => {
		if (cutoffMs != null && itemTimestampMs(item) < cutoffMs) return false;

		const entries = entriesOf(item);
		if (entries.length === 0) {
			// No parseable entries (rare malformed tx): only show when no
			// entry-based filter is active.
			return (
				filters.tokens.length === 0 &&
				filters.types.length === 0 &&
				filters.amountMin == null &&
				filters.amountMax == null &&
				address === ''
			);
		}

		if (filters.tokens.length > 0 && !entries.some((e) => filters.tokens.includes(e.asset))) {
			return false;
		}
		if (filters.types.length > 0) {
			// 'call' should also match 'call_contract'.
			const matchesType = entries.some((e) =>
				filters.types.some((t) => e.type === t || e.type.startsWith(t + '_'))
			);
			if (!matchesType) return false;
		}
		if (filters.amountMin != null || filters.amountMax != null) {
			const inRange = entries.some((e) => {
				if (e.amountHuman == null) return false;
				if (filters.amountMin != null && e.amountHuman < filters.amountMin) return false;
				if (filters.amountMax != null && e.amountHuman > filters.amountMax) return false;
				return true;
			});
			if (!inRange) return false;
		}
		if (address !== '') {
			const matchesAddress = entries.some(
				(e) =>
					e.from.toLowerCase().includes(address) || e.to.toLowerCase().includes(address)
			);
			if (!matchesAddress) return false;
		}
		return true;
	});
}

// ─── Server-side mapping ─────────────────────────────────────────────────────

/**
 * The subset of filters expressible as GraphQL TransactionFilter options.
 * Used to make paginated fetches return mostly-matching rows; the client
 * filter above remains the display source of truth.
 *
 * byLedgerToFrom is exact-match on the server, so we only pass the address
 * through when it looks like a full account (contains ':' as in
 * 'hive:user' / 'did:pkh:…') — for partial text the server filter would
 * wrongly return nothing and starve the client filter of candidates.
 */
export function toServerFilterVars(filters: TxFilters): {
	byType?: string[];
	byLedgerToFrom?: string;
} {
	const out: { byType?: string[]; byLedgerToFrom?: string } = {};
	if (filters.types.length > 0) {
		// Expand 'call' to the wire-level op names.
		out.byType = filters.types.flatMap((t) => (t === 'call' ? ['call', 'call_contract'] : [t]));
	}
	const addr = filters.address.trim();
	if (addr.includes(':')) {
		out.byLedgerToFrom = addr;
	}
	return out;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export type TxSortColumn = 'date' | 'amount';
export type TxSortDirection = 'asc' | 'desc';

/**
 * Representative USD value of a tx item for amount sorting: the LARGEST
 * entry (ledger or op leg) valued at current prices. Max — not sum —
 * because a swap's ledger repeats the same value across hops (in→pool,
 * pool→out, fee) and summing would double-count. Entries in assets we
 * can't price contribute 0.
 */
export function itemAmountUsd(
	item: TxListItem,
	usdPrices: { hive: number; hbd: number; btc: number }
): number {
	let max = 0;
	for (const e of entriesOf(item)) {
		if (e.amountHuman == null) continue;
		const price = usdPrices[e.asset as keyof typeof usdPrices] ?? 0;
		const usd = Math.abs(e.amountHuman) * price;
		if (usd > max) max = usd;
	}
	return max;
}

/**
 * Sort the (already filtered) tx list client-side. Date desc is the feed's
 * natural order — sorting is stable (Array.prototype.sort is stable per
 * spec) so equal keys keep their incoming order.
 */
export function sortTxItems(
	items: TxListItem[],
	col: TxSortColumn,
	dir: TxSortDirection,
	usdPrices: { hive: number; hbd: number; btc: number }
): TxListItem[] {
	const sign = dir === 'asc' ? 1 : -1;
	const key =
		col === 'date'
			? (i: TxListItem) => itemTimestampMs(i)
			: (i: TxListItem) => itemAmountUsd(i, usdPrices);
	return [...items].sort((a, b) => sign * (key(a) - key(b)));
}
