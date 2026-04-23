import { hasuraQuery, hasuraQueryRaw } from './query';

// Common indexer fields present on every BTC mapping event row.
interface BtcMappingEventBase {
	indexer_ts: string;
	indexer_contract_id: string;
	indexer_tx_hash: string;
	indexer_block_height: number;
}

// btc_mapping_deposit_events — emitted on `map` (BTC → VSC deposit)
export interface BtcDepositEvent extends BtcMappingEventBase {
	amount: string; // satoshis
	recipient: string; // recipient VSC DID
	sender: string; // sender BTC address
}

// btc_mapping_unmap_events — emitted on `unmap` (VSC → BTC withdrawal)
export interface BtcUnmapEvent extends BtcMappingEventBase {
	deducted: string; // satoshis deducted from the sender's VSC account (total cost)
	sent: string; // satoshis actually sent to the BTC address (deducted minus bridge fee)
	from_addr: string; // sender VSC DID
	to_addr: string | null; // recipient BTC address — null on older unmap rows
	tx_id: string; // Bitcoin transaction ID (once broadcast)
}

// btc_mapping_transfer_events — emitted on `transfer` / `transferFrom` (VSC → VSC)
export interface BtcTransferEvent extends BtcMappingEventBase {
	amount: string; // satoshis
	sender: string; // sender VSC DID
	recipient: string; // recipient VSC DID
}

/**
 * Returns true when Hasura errors indicate a schema-level issue (missing table or column)
 * rather than a runtime failure. These are expected when the indexer build doesn't yet
 * expose a particular table and should not be logged as errors.
 */
function isSchemaError(errors: Array<{ message: string }>): boolean {
	return errors.some(
		(e) =>
			/field ['"]?\w+['"]? not found in type/i.test(e.message) ||
			/no such field/i.test(e.message) ||
			/column .* does not exist/i.test(e.message) ||
			/relation .* does not exist/i.test(e.message)
	);
}

/** Fetch a deposit (map) event by VSC transaction hash. */
export async function fetchBtcDepositEvent(txHash: string): Promise<BtcDepositEvent | null> {
	const query = `
		query BtcDepositEvent($txHash: String!) {
			btc_mapping_deposit_events(where: { indexer_tx_hash: { _eq: $txHash } }, limit: 1) {
				indexer_ts
				indexer_contract_id
				indexer_tx_hash
				indexer_block_height
				amount
				recipient
				sender
			}
		}
	`;
	const { data, errors } = await hasuraQueryRaw(query, { txHash });
	if (errors && !isSchemaError(errors)) {
		console.error('Hasura query error:', errors);
	}
	const rows = data?.btc_mapping_deposit_events as BtcDepositEvent[] | undefined;
	return rows?.[0] ?? null;
}

/** Fetch an unmap (withdrawal) event by VSC transaction hash. */
export async function fetchBtcUnmapEvent(txHash: string): Promise<BtcUnmapEvent | null> {
	const buildQuery = (includeToAddr: boolean) => `
		query BtcUnmapEvent($txHash: String!) {
			btc_mapping_unmap_events(where: { indexer_tx_hash: { _eq: $txHash } }, limit: 1) {
				indexer_ts
				indexer_contract_id
				indexer_tx_hash
				indexer_block_height
				deducted
				sent
				from_addr
				${includeToAddr ? 'to_addr' : ''}
				tx_id
			}
		}
	`;
	type UnmapResult = { btc_mapping_unmap_events: BtcUnmapEvent[] };

	let result = await hasuraQueryRaw<UnmapResult>(buildQuery(true), { txHash });

	// Some indexer schemas don't expose to_addr — retry without it.
	if (result.errors?.some((e) => /to_addr/.test(e.message))) {
		result = await hasuraQueryRaw<UnmapResult>(buildQuery(false), { txHash });
	}

	// Schema errors (table/column not present in this indexer build) → return null silently.
	// Only log genuinely unexpected errors (non-schema failures).
	if (result.errors && !isSchemaError(result.errors)) {
		console.error('Hasura query error:', result.errors);
	}
	return result.data?.btc_mapping_unmap_events?.[0] ?? null;
}

/** Fetch a transfer event by VSC transaction hash. */
export async function fetchBtcTransferEvent(txHash: string): Promise<BtcTransferEvent | null> {
	const query = `
		query BtcTransferEvent($txHash: String!) {
			btc_mapping_transfer_events(where: { indexer_tx_hash: { _eq: $txHash } }, limit: 1) {
				indexer_ts
				indexer_contract_id
				indexer_tx_hash
				indexer_block_height
				amount
				sender
				recipient
			}
		}
	`;
	const { data, errors } = await hasuraQueryRaw(query, { txHash });
	// Schema errors → indexer doesn't have this table yet; return null silently.
	if (errors && !isSchemaError(errors)) {
		console.error('Hasura query error:', errors);
	}
	const rows = data?.btc_mapping_transfer_events as BtcTransferEvent[] | undefined;
	return rows?.[0] ?? null;
}

export type BtcMappingAction = 'map' | 'unmap' | 'transfer' | 'transferFrom';

export type BtcMappingEventResult =
	| { action: 'map'; event: BtcDepositEvent }
	| { action: 'unmap'; event: BtcUnmapEvent }
	| { action: 'transfer' | 'transferFrom'; event: BtcTransferEvent }
	| null;

/**
 * Fetch deposit events for a recipient, newest first, with cursor-based pagination by block height.
 * Pass `beforeHeight` to fetch events older than a given block height (for scroll-extend).
 * Omit it to fetch the newest `limit` events (for initial load / periodic refresh).
 */
export async function fetchBtcDepositsByRecipient(
	recipient: string,
	limit: number,
	beforeHeight?: number
): Promise<BtcDepositEvent[]> {
	// bigint-safe sentinel for "no upper bound" — block heights won't approach this.
	const heightCursor = beforeHeight ?? Number.MAX_SAFE_INTEGER;
	const query = `
		query BtcDepositsByRecipient($recipient: String!, $limit: Int!, $beforeHeight: bigint!) {
			btc_mapping_deposit_events(
				where: {
					recipient: { _eq: $recipient }
					indexer_block_height: { _lt: $beforeHeight }
				}
				order_by: { indexer_block_height: desc }
				limit: $limit
			) {
				indexer_ts
				indexer_contract_id
				indexer_tx_hash
				indexer_block_height
				amount
				recipient
				sender
			}
		}
	`;
	const data = await hasuraQuery(query, { recipient, limit, beforeHeight: heightCursor });
	return (data?.btc_mapping_deposit_events as BtcDepositEvent[] | undefined) ?? [];
}

/**
 * Fetch the indexer event for a BTC mapping contract call.
 * Dispatches to the correct table based on the action type.
 */
export async function fetchBtcMappingEvent(
	txHash: string,
	action: BtcMappingAction
): Promise<BtcMappingEventResult> {
	if (action === 'map') {
		const event = await fetchBtcDepositEvent(txHash);
		return event ? { action: 'map', event } : null;
	} else if (action === 'unmap') {
		const event = await fetchBtcUnmapEvent(txHash);
		return event ? { action: 'unmap', event } : null;
	} else {
		const event = await fetchBtcTransferEvent(txHash);
		return event ? { action, event } : null;
	}
}
