/**
 * On-chain sources for the notification bell.
 *
 * One GraphQL round-trip per poll, through the same-origin /api/gql proxy the
 * rest of the app uses (direct browser fetches to the nodes get blocked by
 * their CORS policy). Aliased sub-queries keep it to a single request:
 *
 *   1. `findPendingContractUpdates` — authoritative list of contract updates
 *      still inside their timelock. Same data as the witness page's Contract
 *      updates card.
 *   2. `findContract(historical: true)` — every stored contract version,
 *      newest-first. Versions with `activation_height > creation_height` went
 *      through a timelock, i.e. they are updates rather than deploys (the
 *      schema guarantees the two heights are equal for immediate versions).
 *      The ones the head has already passed are the *activated* updates — how
 *      we report an update that came and went while the app was closed, which
 *      a pending-only query can never do. It also carries `name`, so pending
 *      rows get their on-chain label without an extra lookup.
 *   3. `findGovernanceProposals` — witness-vote proposals, newest-first. Only
 *      requested for accounts holding consensus stake.
 *   4. `findTransaction` — the signed-in account's recent transactions, so
 *      pending / failed / confirmed all reach the bell instead of only being
 *      noticed by an open transactions page. Queried under BOTH filters,
 *      because they cover different axes and neither is a superset:
 *        - `byAccount` matches required_auths / posting auths / `ops.data.to` /
 *          payload recipients — you signed it, or someone addressed it to you.
 *        - `byLedgerToFrom` matches the settled `ledger.from` / `ledger.to`,
 *          which is the only way to see value that reached you as the *output*
 *          of someone else's contract call (a lottery payout, a swap routed to
 *          you) — those name you nowhere in the ops.
 *      The two result sets are merged and deduplicated by tx id.
 *
 * `localNodeInfo.last_processed_block` comes along to (a) split historical
 * updates into pending/activated by the same head the node used, and (b)
 * convert governance block heights to wall-clock times — governance proposals
 * carry no timestamps, only Hive block heights, and Hive blocks are 3s.
 *
 * Never throws: a failed poll returns `ok: false` and leaves the bell as-is.
 */
import { GQL_PROXY_VSC, currentGqlUrl, gqlUpstreamHeaders } from '../../client';
import { CONTRACT_REGISTRY } from '$lib/witness/contractUpdates/mockData';
import { tsToUnixSec } from '$lib/witness/contractUpdates/types';

const LOG_TAG = '[notification-feed]';

/** Hive block interval, used to date governance proposals from block heights. */
const HIVE_BLOCK_SECONDS = 3;

/** `findContract` caps `limit` at 100 server-side (larger values are a hard
 *  error, not a silent clamp). One page reaches back months of updates —
 *  far past any realistic "since last visit" window. */
const HISTORY_LIMIT = 100;

/** Enough to cover the open proposals plus recently settled ones. */
const GOVERNANCE_LIMIT = 20;

/** The bell is a recent-activity view, not a ledger — the transactions page
 *  remains the place to page through history. */
const TX_LIMIT = 10;

type RawContract = {
	id: string;
	name?: string | null;
	code?: string | null;
	proposer?: string | null;
	owner?: string | null;
	creation_height: number;
	creation_ts?: string | null;
	activation_height: number;
	activation_ts?: string | null;
};

type RawProposal = {
	proposalId: string;
	type: string;
	status: string;
	creationBlock: number;
	appliedBlock: number;
	amount: number;
	recipient: string;
	slashedAccount: string;
	beneficiary: string;
	votes?: { voter: string }[] | null;
};

type RawLedgerEntry = {
	from?: string | null;
	to?: string | null;
	amount?: number | null;
	asset?: string | null;
	type?: string | null;
};

type RawTx = {
	id: string;
	status: string;
	type: string;
	anchr_ts?: string | null;
	first_seen?: string | null;
	ops?:
		| ({
				type?: string | null;
				index?: number | null;
				data?: Record<string, unknown> | null;
		  } | null)[]
		| null;
	/** Settled effects. Present on confirmed txs; the source of truth for the
	 *  amount, and for who was involved when the ops don't say. */
	ledger?: (RawLedgerEntry | null)[] | null;
};

/** A contract update, classified against the chain head. */
export type FeedContractUpdate = {
	contractId: string;
	/** Curated registry name, else the on-chain `findContract.name`. */
	name?: string;
	proposer: string;
	code: string;
	activationHeight: number;
	/** Unix seconds at which the timelock unlocks (node's estimate). */
	activationSec: number;
	state: 'pending' | 'activated';
	/** Unix seconds of the event this row reports (queued-at / activated-at). */
	eventSec: number;
};

/** A governance proposal, dated from its block heights. */
export type FeedProposal = {
	proposalId: string;
	proposalType: string;
	status: string;
	subject: string;
	amount: number;
	voters: string[];
	eventSec: number;
};

/** One of the signed-in account's transactions. */
export type FeedTransaction = {
	txId: string;
	/** Operation type when available (`transfer`, `stake`, …), else tx type. */
	type: string;
	status: string;
	/** Counterparty DID; '' for operations without one (e.g. contract calls). */
	counterparty: string;
	/** True when the signed-in account is the sender. */
	outgoing: boolean;
	/** Index of the operation being reported — the transactions page opens
	 *  `?tx=<id>&index=<opIndex>` on exactly this row. */
	opIndex: number;
	/** Settled amount in smallest units, from the ledger entry touching this
	 *  account. Undefined when the tx has no ledger effect for us. */
	amount?: number;
	/** Asset of `amount` (`hive`, `hbd`, …). */
	asset?: string;
	eventSec: number;
};

export type FeedSnapshot = {
	updates: FeedContractUpdate[];
	proposals: FeedProposal[];
	transactions: FeedTransaction[];
	/** True when the round-trip produced usable data. A failed poll must not
	 *  be mistaken for "nothing is happening on chain". */
	ok: boolean;
};

export type FeedRequest = {
	/** Only true for accounts with consensus stake — nobody else can vote, so
	 *  the governance field is dead weight for them. */
	includeGovernance: boolean;
	/** Signed-in account DID (`hive:name` / `did:pkh:…`); omitted when logged out. */
	did?: string;
};

const CONTRACT_FIELDS = `id name code proposer owner creation_height creation_ts activation_height activation_ts`;
const TX_FIELDS = `id status type anchr_ts first_seen ops { type index data } ledger { from to amount asset type }`;

function buildQuery(req: FeedRequest): string {
	const governance = req.includeGovernance
		? `governance: findGovernanceProposals(filterOptions: { limit: ${GOVERNANCE_LIMIT} }) {
        proposalId type status creationBlock appliedBlock amount recipient slashedAccount beneficiary
        votes { voter }
      }`
		: '';
	const txs = req.did
		? `txs: findTransaction(filterOptions: { byAccount: ${JSON.stringify(req.did)}, limit: ${TX_LIMIT} }) { ${TX_FIELDS} }
    txsLedger: findTransaction(filterOptions: { byLedgerToFrom: ${JSON.stringify(req.did)}, limit: ${TX_LIMIT} }) { ${TX_FIELDS} }`
		: '';
	return `query NotificationFeed {
    head: localNodeInfo { last_processed_block }
    pending: findPendingContractUpdates(filterOptions: {}) { ${CONTRACT_FIELDS} }
    history: findContract(filterOptions: { historical: true, limit: ${HISTORY_LIMIT} }) { ${CONTRACT_FIELDS} }
    ${governance}
    ${txs}
  }`;
}

const EMPTY: FeedSnapshot = { updates: [], proposals: [], transactions: [], ok: false };

/** Registry name wins over the on-chain one (it's curated and stable).
 *  On-chain names are free text and do contain runs of whitespace in the wild
 *  ("Lumen Creator        Tokens" on mainnet), so collapse them. */
function labelFor(row: RawContract): string | undefined {
	return CONTRACT_REGISTRY[row.id]?.name ?? row.name?.replace(/\s+/g, ' ').trim() ?? undefined;
}

/**
 * Reduce raw contract rows to updates.
 *
 * `pending` is authoritative for the timelocked set. The historical page
 * supplies everything else: a version whose activation height is above its
 * creation height was timelocked, so once the head passes that height it is an
 * update that went live. Deploys (activation == creation) are skipped — they
 * aren't updates and the witness card never showed them either.
 */
function classifyUpdates(
	pending: RawContract[],
	history: RawContract[],
	head: number
): FeedContractUpdate[] {
	const out = new Map<string, FeedContractUpdate>();
	const key = (row: RawContract) => `${row.id}:${row.code ?? ''}`;

	for (const row of pending) {
		out.set(key(row), {
			contractId: row.id,
			name: labelFor(row),
			proposer: row.proposer ?? row.owner ?? '',
			code: row.code ?? '',
			activationHeight: row.activation_height,
			activationSec: row.activation_ts ? tsToUnixSec(row.activation_ts) : 0,
			state: 'pending',
			// While pending, the news is that it was *queued*.
			eventSec: row.creation_ts ? tsToUnixSec(row.creation_ts) : 0
		});
	}

	for (const row of history) {
		if (row.activation_height <= row.creation_height) continue; // deploy, not an update
		const k = key(row);
		const existing = out.get(k);
		if (existing) {
			// Already covered by the authoritative pending list; just fill in a
			// label if the pending row lacked one.
			if (!existing.name) existing.name = labelFor(row);
			continue;
		}
		if (row.activation_height > head) continue; // queued but missing from `pending`
		const activationSec = row.activation_ts ? tsToUnixSec(row.activation_ts) : 0;
		out.set(k, {
			contractId: row.id,
			name: labelFor(row),
			proposer: row.proposer ?? row.owner ?? '',
			code: row.code ?? '',
			activationHeight: row.activation_height,
			activationSec,
			state: 'activated',
			// An activated update's news is that it went live.
			eventSec: activationSec
		});
	}

	return [...out.values()].filter((u) => u.eventSec > 0);
}

/** Hive block height → unix seconds, anchored on the current head. */
function blockToUnixSec(block: number, head: number, nowSec: number): number {
	if (!block || !head) return nowSec;
	return nowSec - (head - block) * HIVE_BLOCK_SECONDS;
}

function classifyProposals(raw: RawProposal[], head: number, nowSec: number): FeedProposal[] {
	return raw.map((p) => {
		// Settled proposals are dated by when they settled, open ones by their
		// first vote (creationBlock, which anchors the expiry window).
		const anchor = p.status === 'open' || !p.appliedBlock ? p.creationBlock : p.appliedBlock;
		return {
			proposalId: p.proposalId,
			proposalType: p.type,
			status: p.status,
			subject: p.recipient || p.slashedAccount || p.beneficiary || '',
			amount: p.amount,
			voters: (p.votes ?? []).map((v) => v.voter),
			eventSec: blockToUnixSec(anchor, head, nowSec)
		};
	});
}

/**
 * Same rule as txStores.getTimestamp: prefer the anchor time, fall back to
 * first-seen, and treat a designator-less timestamp as UTC (the node emits
 * bare "2026-09-01T19:02:06", which JS would otherwise read as local time).
 */
function txUnixSec(tx: RawTx): number {
	const raw = tx.anchr_ts || tx.first_seen;
	if (!raw) return 0;
	return tsToUnixSec(raw);
}

/**
 * The ledger entry that moved value to or from this account, preferring one
 * with a real counterparty. This is what makes someone else's transaction
 * legible: a lottery payout names us only here, in the settled output of a
 * contract call we never signed.
 */
function ledgerEntryFor(tx: RawTx, did: string): RawLedgerEntry | undefined {
	const mine = (tx.ledger ?? []).filter(
		(l): l is RawLedgerEntry => !!l && (l.from === did || l.to === did)
	);
	// A self-move (withdraw: from == to == us) is the least informative, so it
	// only wins if nothing else touches us.
	return mine.find((l) => (l.to === did ? l.from : l.to) !== did) ?? mine[0];
}

/**
 * Reduce a transaction to the one line the bell shows.
 *
 * Counterparty precedence: an operation that names a *different* account wins
 * (that's the plain "Transfer to @x" case); otherwise we fall back to the
 * ledger, which is the only place a contract-driven credit names us. Ops with
 * no counterparty either way — a bare contract call, a withdrawal, which the
 * node records with from == to — still notify, just without the "to @x" half.
 *
 * The amount always comes from the ledger (smallest units) rather than the op
 * payload (a decimal string), so it needs no unit guessing. Failed txs get no
 * amount: nothing moved, and showing one would misstate what happened.
 */
export function classifyTransaction(tx: RawTx, did: string): FeedTransaction {
	let counterparty = '';
	let outgoing = true;
	let opType = '';
	let opIndex = 0;
	for (const op of tx.ops ?? []) {
		if (!op) continue;
		const data = (op.data ?? {}) as { from?: string; to?: string };
		if (!opType) {
			opType = op.type ?? '';
			opIndex = op.index ?? 0;
		}
		if (data.from === did && data.to && data.to !== did) {
			counterparty = data.to;
			outgoing = true;
			opIndex = op.index ?? opIndex;
			break;
		}
		if (data.to === did && data.from && data.from !== did) {
			counterparty = data.from;
			outgoing = false;
			opIndex = op.index ?? opIndex;
			break;
		}
	}

	const entry = ledgerEntryFor(tx, did);
	if (entry) {
		if (!counterparty) {
			const other = entry.to === did ? entry.from : entry.to;
			if (other && other !== did) {
				counterparty = other;
				outgoing = entry.to === did ? false : true;
			}
		}
	}

	const settled = entry && tx.status !== 'FAILED' && typeof entry.amount === 'number';
	return {
		txId: tx.id,
		type: opType || tx.type,
		status: tx.status,
		counterparty,
		outgoing,
		opIndex,
		amount: settled ? entry!.amount! : undefined,
		asset: settled ? (entry!.asset ?? undefined) : undefined,
		eventSec: txUnixSec(tx)
	};
}

/** First occurrence wins; the two tx filters overlap heavily. */
function mergeById(rows: (RawTx | null)[]): RawTx[] {
	const seen = new Set<string>();
	const out: RawTx[] = [];
	for (const row of rows) {
		if (!row || seen.has(row.id)) continue;
		seen.add(row.id);
		out.push(row);
	}
	return out;
}

/** Fetch one snapshot of the feed's on-chain sources. */
export async function fetchFeed(
	req: FeedRequest,
	nowSec: number = Math.floor(Date.now() / 1000)
): Promise<FeedSnapshot> {
	try {
		const res = await fetch(GQL_PROXY_VSC, {
			method: 'POST',
			headers: gqlUpstreamHeaders(currentGqlUrl),
			body: JSON.stringify({ query: buildQuery(req) })
		});
		// A GraphQL validation failure comes back as HTTP 422 with the errors in
		// the body, so read the body before judging by status.
		const json = (await res.json().catch(() => null)) as null | {
			data?: {
				head?: { last_processed_block?: number } | null;
				pending?: RawContract[] | null;
				history?: RawContract[] | null;
				governance?: RawProposal[] | null;
				txs?: RawTx[] | null;
				txsLedger?: RawTx[] | null;
			};
			errors?: { message: string }[];
		};
		if (!json) {
			console.warn(`${LOG_TAG} HTTP ${res.status} with non-JSON body`);
			return EMPTY;
		}
		if (json.errors?.length) {
			// A node that doesn't serve these fields yet errors on every poll;
			// the bell simply stays free of feed rows.
			console.warn(`${LOG_TAG} GraphQL error:`, json.errors[0].message);
			return EMPTY;
		}
		if (!res.ok) {
			console.warn(`${LOG_TAG} HTTP ${res.status} from proxy/upstream`);
			return EMPTY;
		}
		const head = json.data?.head?.last_processed_block ?? 0;
		return {
			updates: classifyUpdates(json.data?.pending ?? [], json.data?.history ?? [], head),
			proposals: req.includeGovernance
				? classifyProposals(json.data?.governance ?? [], head, nowSec)
				: [],
			transactions: req.did
				? mergeById([...(json.data?.txs ?? []), ...(json.data?.txsLedger ?? [])]).map((tx) =>
						classifyTransaction(tx, req.did!)
					)
				: [],
			ok: true
		};
	} catch (e) {
		console.warn(`${LOG_TAG} fetch threw:`, e);
		return EMPTY;
	}
}
