/**
 * Moving a Magi custom token (a `magi_token-contract` instance).
 *
 * A custom token is NOT on the Magi ledger: HIVE, HBD, BTC, ETH and USDC are
 * ledger assets a `transfer` op moves, while a custom token's balances live in
 * its own contract's state. So this is a contract call on the token, not a
 * ledger transfer, and the same symbol can exist on two contracts (mainnet has
 * two `LASSECASH`), which is why the caller passes the contract the token's
 * pool is actually bound to — `CustomToken.contractId` from
 * `$lib/tokens/customTokens`, never a symbol lookup of its own.
 *
 * Mirrors `buildTokenTransfer` in @vsc.eco/token-core (`packages/core/src/ops/
 * token.ts`): action `transfer`, payload `{ to, amount }` in smallest units,
 * `rc_limit` 10000, no intents.
 */

import type { CustomJsonOperation } from '@hiveio/dhive';
import { vscNetworkId } from '../../../../client';

/**
 * The call's `rc_limit`, matching @vsc.eco/token-core's default.
 *
 * A transfer writes two balance keys, so it costs well under this; the node
 * charges only what the call uses, so the limit is a cap. It is deliberately
 * not ABOVE the 10,000 free allowance: past that the node reserves
 * (rc_limit − free RC) of the caller's HBD against RC before the call, which
 * would make a token transfer need HBD on the ledger to go through.
 */
export const CUSTOM_TOKEN_TRANSFER_RC = 10_000;

/**
 * Send `rawAmount` (smallest units of the token's own `decimals`) of the token
 * held at `tokenContractId` to `toDid`.
 *
 * `toDid` is a resolved DID, NOT a username: the token contract stores
 * balances by DID, and a Magi account can be a Hive name, an EVM address or a
 * Bitcoin address. Callers pass `getDidFromUsername(...)`, which maps each of
 * those to the right form — never a bare `hive:` prefix, which on a wallet
 * login would build a `hive:0x…` recipient that owns nothing.
 */
export function getCustomTokenTransferOp(
	username: string,
	tokenContractId: string,
	toDid: string,
	rawAmount: number | string
): CustomJsonOperation {
	const op = {
		net_id: vscNetworkId,
		caller: `hive:${username}`,
		contract_id: tokenContractId,
		action: 'transfer',
		payload: JSON.stringify({
			to: toDid,
			// Smallest units as a string: a token may use 8 decimals, and the
			// contract reads an integer string, not a float.
			amount: String(rawAmount)
		}),
		rc_limit: CUSTOM_TOKEN_TRANSFER_RC,
		intents: [] as Array<{ type: string; args: Record<string, string> }>
	};

	return [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(op)
		}
	];
}
