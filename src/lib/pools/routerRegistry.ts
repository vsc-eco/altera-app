/**
 * Whether the DEX router can actually route a pool.
 *
 * A pool contract is self-contained: its `deposit` entrypoint works when called
 * directly, which is how mainnet's HBD:LASSECASH pool came to hold funds
 * (`lp_minted` = isqrt(a0*a1), the first-deposit formula, straight to the pool
 * on 2026-09-08). Router registration is a separate step — it's what lets the
 * ROUTER find the pool. Everything Altera does goes through the router, so a
 * pool missing that registration accepts nothing from us: swaps and both
 * liquidity directions abort.
 *
 * Registration lives in the router's own state, written by `register_token`
 * (`asset-<symbol>`) and `register_pool` (`pool-<a>-<b>`, pair in the pool's
 * alphabetical order). Note the `-` path delimiter, not `/`.
 */

import { GetStateByKeysStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { DEX_ROUTER_CONTRACT_ID } from '../../client';

export const routerAssetKey = (symbol: string) => `asset-${symbol.toLowerCase()}`;
export const routerPoolKey = (asset0: string, asset1: string) =>
	`pool-${asset0.toLowerCase()}-${asset1.toLowerCase()}`;

export type RouterRegistration = {
	registered: boolean;
	/** Which step is missing — surfaced so the operator fix is obvious. */
	missing?: 'register_token' | 'register_pool' | 'pool_mismatch';
};

export type RegistrationQuery = {
	contractId: string;
	/** The pair in the pool's own normalised (alphabetical) order. */
	symbols: [string, string];
};

const UNREADABLE: RouterRegistration = { registered: false, missing: 'register_pool' };

/**
 * Ask the router which of these pools it knows about, in one batched read.
 *
 * A pool counts as registered only when both its assets are registered AND the
 * router's pool entry names this exact contract — a stale entry pointing at a
 * superseded pool for the same pair is not a pool we can use.
 *
 * On a failed read every pool is reported unregistered: better to disable an
 * action than to offer one that aborts on chain.
 */
export async function fetchRouterRegistrations(
	pools: RegistrationQuery[]
): Promise<Map<string, RouterRegistration>> {
	const out = new Map<string, RouterRegistration>();
	if (pools.length === 0) return out;

	const keys = [
		...new Set(
			pools.flatMap((p) => [
				routerAssetKey(p.symbols[0]),
				routerAssetKey(p.symbols[1]),
				routerPoolKey(p.symbols[0], p.symbols[1])
			])
		)
	];

	let state: Record<string, string | null | undefined>;
	try {
		const res = await queryOnce(new GetStateByKeysStore(), {
			variables: { contractId: DEX_ROUTER_CONTRACT_ID, keys },
			policy: 'NetworkOnly'
		});
		state = (res.data?.getStateByKeys ?? {}) as Record<string, string | null | undefined>;
	} catch (err) {
		console.error('Failed to read DEX router registration', err);
		for (const p of pools) out.set(p.contractId, UNREADABLE);
		return out;
	}

	for (const p of pools) {
		const asset0 = state[routerAssetKey(p.symbols[0])]?.trim();
		const asset1 = state[routerAssetKey(p.symbols[1])]?.trim();
		const pool = state[routerPoolKey(p.symbols[0], p.symbols[1])]?.trim();

		if (!asset0 || !asset1) {
			out.set(p.contractId, { registered: false, missing: 'register_token' });
		} else if (!pool) {
			out.set(p.contractId, { registered: false, missing: 'register_pool' });
		} else if (pool !== p.contractId) {
			out.set(p.contractId, { registered: false, missing: 'pool_mismatch' });
		} else {
			out.set(p.contractId, { registered: true });
		}
	}
	return out;
}

/** Closing reassurance: this is an operator step, not something the user can
 *  act on, so the hint says who resolves it. */
const HINT_SUFFIX = 'The Magi team will take care for that.';

/** Human-readable reason a pool can't be used, for tooltips. */
export function registrationHint(reg: RouterRegistration | undefined, pair: string): string {
	if (!reg || reg.registered) return '';
	if (reg.missing === 'pool_mismatch') {
		return (
			`${pair} is not the pool the DEX routes for this pair — liquidity here is ` +
			`unreachable. ${HINT_SUFFIX}`
		);
	}
	return (
		`${pair} is not registered on the DEX yet, so deposits would fail. It needs ` +
		`register_token and register_pool on the router. ${HINT_SUFFIX}`
	);
}
