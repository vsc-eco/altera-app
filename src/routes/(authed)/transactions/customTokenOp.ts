import { tokenForContract } from '$lib/tokens/assetCoin.svelte';
import type { TransactionOpType } from '$lib/stores/txStores';

/**
 * A Magi custom token's own `transfer` / `transferFrom` call, shown as the
 * transfer it is.
 *
 * Every contract call with one of those action names used to be sent to the
 * BTC mapping row, which read the amount as SATOSHIS and priced it as BITCOIN:
 * risingstarhub sending 0.3 STARPRO to jef-001 rendered as "0.0003 BTC, approx
 * $17.89", from and to both read as the viewer, and the popup named the BTC
 * mapping contract rather than the one actually called. Same shape as
 * `evmBridgeOpAsTransfer`, for the same reason — as a plain transfer op the
 * regular row takes the coin from `asset`, the parties from `from`/`to` and
 * the direction from the viewed account.
 *
 * `signer` is the transaction's first required auth. For `transfer` that IS
 * the sender: the contract debits its caller. For `transferFrom` the funds
 * leave the payload's `from` (an allowance the signer is spending), so that
 * account is shown instead.
 *
 * Returns null for anything that is not a known token contract's transfer —
 * including while the token registry is still loading, so a row is never
 * labelled with a symbol that has not been confirmed.
 */
export function customTokenOpAsTransfer(
	op: TransactionOpType,
	signer: string | undefined
): TransactionOpType | null {
	if (op.type !== 'call' && op.type !== 'call_contract') return null;
	const data = (op.data ?? {}) as Record<string, unknown>;
	const action = String(data.action ?? '');
	if (action !== 'transfer' && action !== 'transferFrom') return null;

	const contractId = typeof data.contract_id === 'string' ? data.contract_id : '';
	const coin = tokenForContract(contractId);
	if (!coin) return null;

	let payload: Record<string, unknown> | null;
	try {
		payload = (
			typeof data.payload === 'string' ? JSON.parse(data.payload) : data.payload
		) as Record<string, unknown> | null;
	} catch {
		return null;
	}
	if (!payload) return null;

	// Smallest units of the token's own decimals; a number tells the row it is
	// preshifted (0.3 STARPRO is "30000" at 5 places, not 30000 tokens).
	const amount = Number(payload.amount);
	if (!Number.isFinite(amount) || amount <= 0) return null;

	const to = String(payload.to ?? '');
	if (!to) return null;
	const from = action === 'transferFrom' ? String(payload.from ?? signer ?? '') : (signer ?? '');

	return {
		...op,
		type: 'transfer',
		data: {
			from,
			to,
			asset: coin.value,
			amount
		}
	};
}
