import { hasuraQuery } from './query';

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
	to_addr: string; // recipient BTC address
	tx_id: string; // Bitcoin transaction ID (once broadcast)
}

// btc_mapping_transfer_events — emitted on `transfer` / `transferFrom` (VSC → VSC)
export interface BtcTransferEvent extends BtcMappingEventBase {
	amount: string; // satoshis
	sender: string; // sender VSC DID
	recipient: string; // recipient VSC DID
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
	const data = await hasuraQuery(query, { txHash });
	const rows = data?.btc_mapping_deposit_events as BtcDepositEvent[] | undefined;
	return rows?.[0] ?? null;
}

/** Fetch an unmap (withdrawal) event by VSC transaction hash. */
export async function fetchBtcUnmapEvent(txHash: string): Promise<BtcUnmapEvent | null> {
	const query = `
		query BtcUnmapEvent($txHash: String!) {
			btc_mapping_unmap_events(where: { indexer_tx_hash: { _eq: $txHash } }, limit: 1) {
				indexer_ts
				indexer_contract_id
				indexer_tx_hash
				indexer_block_height
				deducted
				sent
				from_addr
				to_addr
				tx_id
			}
		}
	`;
	const data = await hasuraQuery(query, { txHash });
	const rows = data?.btc_mapping_unmap_events as BtcUnmapEvent[] | undefined;
	return rows?.[0] ?? null;
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
	const data = await hasuraQuery(query, { txHash });
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
 * Fetch all deposit events where the given DID is the recipient, at or above a VSC block height.
 * Used to interleave incoming BTC deposits (which don't appear in the user's VSC tx list) into
 * the transaction table. Only a lower bound is needed — new deposits at any height should appear.
 */
export async function fetchBtcDepositsByRecipient(
	recipient: string,
	minHeight: number
): Promise<BtcDepositEvent[]> {
	const query = `
		query BtcDepositsByRecipient($recipient: String!, $minHeight: bigint!) {
			btc_mapping_deposit_events(
				where: {
					recipient: { _eq: $recipient }
					indexer_block_height: { _gte: $minHeight }
				}
				order_by: { indexer_block_height: desc }
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
	const data = await hasuraQuery(query, { recipient, minHeight });
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
