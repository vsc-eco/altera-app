import { EVM_BRIDGE_CONTRACT_ID } from '$lib/constants';
import { canonicalIdentity } from '$lib/magiTransactions/evmBridge';
import type { TransactionOpType } from '$lib/stores/txStores';

/**
 * The EVM bridge's own calls, shown as the transfers they are. The bridge holds
 * ETH and USDC on one contract: `transfer` moves them between Magi accounts and
 * `unmapETH` / `unmapERC20` withdraw them to an Ethereum address. The table sent
 * every `transfer` call to the BTC mapping row, which read an ETH or USDC amount
 * as BTC; as a plain transfer op the regular row (Tr) takes the coin from
 * `asset` and the direction from the viewed account.
 *
 * `signer` is the transaction's first required auth (the account the bridge
 * debits). Returns null for anything that is not one of these bridge calls.
 */
export function evmBridgeOpAsTransfer(
	op: TransactionOpType,
	signer: string | undefined,
	bridgeId: string = EVM_BRIDGE_CONTRACT_ID
): TransactionOpType | null {
	if (!bridgeId || (op.type !== 'call' && op.type !== 'call_contract')) return null;
	const data = (op.data ?? {}) as Record<string, unknown>;
	if (data.contract_id !== bridgeId) return null;
	const action = String(data.action ?? '');
	if (action !== 'transfer' && action !== 'unmapETH' && action !== 'unmapERC20') return null;
	let payload: Record<string, unknown> | null;
	try {
		payload = (
			typeof data.payload === 'string' ? JSON.parse(data.payload) : data.payload
		) as Record<string, unknown> | null;
	} catch {
		return null;
	}
	if (!payload) return null;
	const asset = action === 'unmapETH' ? 'eth' : String(payload.asset ?? '').toLowerCase();
	if (asset !== 'eth' && asset !== 'usdc') return null;
	// Smallest units (wei / USDC's 6 places); a number tells Tr it is preshifted.
	const amount = Number(payload.amount);
	if (!Number.isFinite(amount) || amount <= 0) return null;
	const to = String(payload.to ?? '');
	return {
		...op,
		type: action === 'transfer' ? 'transfer' : 'withdraw',
		data: {
			from: signer ?? '',
			// The bridge keys an Ethereum account by its checksummed DID; the
			// viewed account's DID is checksummed too, so incoming matches.
			to: action === 'transfer' ? canonicalIdentity(to) : to,
			asset,
			amount
		}
	};
}
