/**
 * Contract update types.
 *
 * Aligned with the `findPendingContractUpdates` GraphQL field landing in
 * go-vsc-node PR #210 (https://github.com/vsc-eco/go-vsc-node/pull/210).
 *
 * Two layers:
 *
 *   1. `PendingContractUpdate` — the raw GraphQL shape. Backend canonical.
 *      Once PR #210 merges, this is what Houdini returns from
 *      `findPendingContractUpdatesQuery`.
 *
 *   2. `ContractMetadata` — client-side enrichment (human name, category,
 *      title/description, repo link). The chain has no concept of these
 *      and never will — names come from `findContract.name` and the rest
 *      from a committed registry in `mockData.ts` (later: a tiny YAML /
 *      markdown registry the VSC team curates).
 *
 * The view layer renders `ContractUpdateView` (raw + enrichment).
 */

/**
 * Subset of `Contract` fields returned by `findPendingContractUpdates`.
 *
 * Note: PR #210 doesn't introduce a new type — it adds `activation_height`,
 * `activation_ts`, and `proposer` to the existing `Contract` type, and
 * exposes `findPendingContractUpdates(filterOptions: FindContractFilter): [Contract]`.
 * This shape is just the projection we query.
 */
export type PendingContractUpdate = {
	/** Contract id being updated (e.g. "vsc1Boa..."). NOT a proposal id. */
	id: string;
	/** IPFS CID of the new WASM code waiting to activate. */
	code: string;
	/** Account that signed the update transaction. */
	proposer: string;
	/** Contract owner account (governance authority that can sign updates). */
	owner: string;
	/** Block height when the update was queued. */
	creation_height: number;
	/** Block height when the timelock unlocks and the update activates. */
	activation_height: number;
	/** ISO 8601 date-time string — estimated wall-clock activation. */
	activation_ts: string;
};

/**
 * Parse an ISO 8601 date-time string (Contract.activation_ts /
 * creation_ts) to unix seconds.
 *
 * The node emits bare timestamps without a timezone designator
 * ("2026-06-12T14:08:45" — verified live on testnet 2026-06-12) which
 * JS parses as LOCAL time, shifting the activation by the user's UTC
 * offset (the countdown showed "unlocked" for a pending update). The
 * values are UTC — append Z when no designator is present, same as
 * txStores.getTimestamp does for anchr_ts.
 */
export function tsToUnixSec(iso: string): number {
	const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
	return Math.floor(Date.parse(hasTimezone ? iso : iso + 'Z') / 1000);
}

/** Off-chain metadata for a known contract — display only. */
export type ContractMetadata = {
	/** Human-readable contract name (e.g. "Pool: HIVE/HBD"). */
	name: string;
	/** Tag drives color coding + filtering. */
	category: 'pool' | 'bridge' | 'gateway' | 'oracle' | 'governance' | 'other';
	/** Optional one-line summary of what this contract does. */
	description?: string;
};

/** Raw update + optional enrichment + optional previous code (for diff). */
export type ContractUpdateView = PendingContractUpdate & {
	/** Joined from the curated registry or a `findContract(byId)` lookup. */
	metadata?: ContractMetadata;
	/** On-chain contract name from `findContract(byId)` — fallback label
	 *  when the contract isn't in the curated registry. */
	chainName?: string;
	/** Current on-chain code CID — what will be replaced. From `findContract`. */
	previousCode?: string;
};
