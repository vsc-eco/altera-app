/**
 * Balances for Magi custom tokens.
 *
 * These can't live in `accountBalance`: that store holds a fixed struct of
 * native assets read from the VSC node's `getAccountBalance`, whereas token
 * balances are per-contract rows in the Magi indexer. Keeping them in their
 * own store means the native balance poller is untouched and a slow/failing
 * indexer can't stall the dashboard's balances.
 *
 * Amounts are RAW smallest units, matching `accountBalance.bal` — pass them to
 * `new CoinAmount(raw, coin, true)`.
 */

import { writable } from 'svelte/store';
import { hasuraQuery } from '$lib/indexer/query';
import { fetchCustomTokens } from './customTokens';

export type CustomTokenBalances = {
	/** Raw smallest units, keyed by lowercase symbol. */
	bal: Record<string, number>;
	loading: boolean;
	/** DID the balances belong to, so a stale response can be discarded. */
	did: string | null;
};

export const customTokenBalances = writable<CustomTokenBalances>({
	bal: {},
	loading: false,
	did: null
});

/**
 * Fetch the given account's balance for every pool-backed custom token.
 *
 * Rows are keyed by contract id in the indexer, so we map them back onto
 * symbols via the token list — a token whose contract has no row for this
 * account simply has no balance, which we record as 0 rather than omitting,
 * so the picker can show "0" instead of a blank.
 */
/** DID of the most recent refresh, so an earlier in-flight response that
 *  resolves after an account switch can be discarded instead of writing the
 *  previous account's holdings over the new one. */
let latestDid: string | null = null;

export async function refreshCustomTokenBalances(did: string): Promise<void> {
	latestDid = did || null;
	if (!did) {
		customTokenBalances.set({ bal: {}, loading: false, did: null });
		return;
	}
	customTokenBalances.update((s) => ({ ...s, loading: true }));
	try {
		const tokens = await fetchCustomTokens();
		if (tokens.length === 0) {
			if (latestDid !== did) return;
			customTokenBalances.set({ bal: {}, loading: false, did });
			return;
		}
		const query = `
			query CustomTokenBalances($account: String!, $contracts: [String!]) {
				magi_token_balances(
					where: { account: { _eq: $account }, contract_id: { _in: $contracts } }
				) {
					contract_id
					balance
				}
			}
		`;
		const data = await hasuraQuery(query, {
			account: did,
			contracts: tokens.map((t) => t.contractId)
		});
		const rows = (data?.magi_token_balances ?? []) as Array<{
			contract_id: string;
			balance: number | string;
		}>;
		const byContract = new Map(rows.map((r) => [r.contract_id, Number(r.balance) || 0]));

		const bal: Record<string, number> = {};
		for (const token of tokens) {
			bal[token.symbol] = byContract.get(token.contractId) ?? 0;
		}

		if (latestDid !== did) return;
		customTokenBalances.set({ bal, loading: false, did });
	} catch (err) {
		console.error('Failed to fetch custom token balances', err);
		if (latestDid !== did) return;
		customTokenBalances.set({ bal: {}, loading: false, did });
	}
}
