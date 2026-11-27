import { hasuraQueryRaw } from './query';
import { canonicalIdentity } from '$lib/magiTransactions/evmBridge';

/**
 * A deposit the EVM bridge credited on Magi, from the indexer's
 * evm_mapping_deposit_events table. The bridge logs
 * "map|t=<credited account>|f=<Ethereum sender>|a=<amount>|as=<asset>|bn=<L1 block>|ti=<tx index>"
 * on every credit (as the BTC bridge logs "map|t=|f=|a="), and the indexer's
 * evm_mapping mapping turns it into this row.
 */
export interface EvmDepositEvent {
	indexer_ts: string;
	indexer_contract_id: string;
	indexer_tx_hash: string;
	indexer_block_height: number;
	amount: string; // smallest units as text (exact): wei for ETH, 6 places for USDC
	recipient: string; // the Magi account credited
	sender: string; // the Ethereum address that paid
	asset: string; // 'eth' | 'usdc'
	l1_block: number; // the Ethereum block of the deposit
	l1_tx_index: number; // its transaction's index in that block
}

/** The table, or one of its columns, is not there yet: the indexer has not
 *  been given the EVM bridge mapping. Not an error to report on every poll. */
function isSchemaError(errors: Array<{ message: string }>): boolean {
	return errors.some(
		(e) =>
			/field ['"]?\w+['"]? not found in type/i.test(e.message) ||
			/no such field/i.test(e.message) ||
			/column .* does not exist/i.test(e.message) ||
			/relation .* does not exist/i.test(e.message)
	);
}

/** The forms the bridge may have keyed this account under: as given, and for
 *  an Ethereum account its checksummed DID (crypto.AddressToDID). */
export function recipientForms(did: string): string[] {
	return [...new Set([did, canonicalIdentity(did)])];
}

/** The account's EVM deposits, newest first, before `beforeHeight`; [] when
 *  the indexer does not have the table yet. */
export async function fetchEvmDepositsByRecipient(
	did: string,
	limit: number,
	beforeHeight?: number
): Promise<EvmDepositEvent[]> {
	const query = `
		query EvmDepositsByRecipient($recipients: [String!]!, $limit: Int!, $beforeHeight: bigint!) {
			evm_mapping_deposit_events(
				where: {
					recipient: { _in: $recipients }
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
				asset
				l1_block
				l1_tx_index
			}
		}
	`;
	const { data, errors } = await hasuraQueryRaw(query, {
		recipients: recipientForms(did),
		limit,
		beforeHeight: beforeHeight ?? Number.MAX_SAFE_INTEGER
	});
	if (errors) {
		if (isSchemaError(errors)) return [];
		console.error('Hasura query error:', errors);
	}
	const rows = (data?.evm_mapping_deposit_events as EvmDepositEvent[] | undefined) ?? [];
	// Only the assets this app knows how to show.
	return rows.filter((r) => r.asset === 'eth' || r.asset === 'usdc');
}
