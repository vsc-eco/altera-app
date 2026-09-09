/**
 * Discovery of Magi custom tokens (`magi_token-contract` instances) that are
 * actually tradeable — i.e. that have a registered DEX pool.
 *
 * Two traps this module exists to handle:
 *
 * 1. **Symbols are not unique.** Mainnet has two contracts both claiming
 *    `LASSECASH`; only one is bound to the live pool. The DEX router names
 *    assets by SYMBOL in `asset_in`/`asset_out`, but `approve` has to target
 *    the token CONTRACT — so we need both, and we have to resolve the contract
 *    from the pool rather than from the token registry.
 * 2. **The registry lists tokens with no pool** (DIY, FERNLET today). Those
 *    can't be swapped: there's nothing to route through. We only surface
 *    tokens whose pool exists, so nothing in the picker is a dead end.
 *
 * The pool's own state is the source of truth for the binding: `a0n`/`a1n`
 * hold the pair's asset names and `a0m`/`a1m` the mapping contract for that
 * side (empty for native assets).
 */

import { GetStateByKeysStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { hasuraQuery } from '$lib/indexer/query';
import { fetchPoolRegistry } from '$lib/indexer/poolQueries';
import { isNativeAsset } from '$lib/pools/poolsData';
import type { Coin } from '$lib/sendswap/utils/sendOptions';

/** A custom token that can actually be swapped, with everything the swap
 *  flow needs: the symbol the router routes on, the contract `approve`
 *  targets, and the pool the quote reads its reserves from. */
export type CustomToken = {
	/** Lowercase symbol — matches `Coin.value` and the router's asset names. */
	symbol: string;
	/** Uppercase symbol, for display. */
	label: string;
	/** Human-readable token name from the token contract. */
	name: string;
	decimals: number;
	/** magi_token contract: holds balances, and is the `approve` target when
	 *  this token is the swap INPUT. */
	contractId: string;
	/** The DEX pool pairing this token with HBD. */
	poolContractId: string;
};

/** Custom tokens ship no artwork of their own, so they carry the Magi mark:
 *  it reads as "a token on this chain" rather than the `unk.svg` error glyph. */
export const CUSTOM_TOKEN_ICON = '/magi.svg';

/** Adapt a discovered token to the `Coin` shape the send/swap flows use.
 *  `value` is the lowercase symbol — the same name the DEX router routes on
 *  in `asset_in` / `asset_out`. */
export function customTokenCoin(token: CustomToken): Coin {
	return {
		value: token.symbol,
		label: token.label,
		icon: CUSTOM_TOKEN_ICON,
		unit: token.label,
		decimalPlaces: token.decimals
	};
}

/** Pool state keys holding the pair's asset names and mapping contracts. */
const POOL_BINDING_KEYS = ['a0n', 'a1n', 'a0m', 'a1m'] as const;

type TokenOverviewRow = {
	contract_id: string;
	symbol: string;
	name: string | null;
	decimals: number | string | null;
	paused: boolean | null;
};

/** Every token the indexer knows about, keyed by contract id. */
async function fetchTokenOverview(): Promise<Map<string, TokenOverviewRow>> {
	const query = `
		query MagiTokenOverview {
			magi_token_overview {
				contract_id
				symbol
				name
				decimals
				paused
			}
		}
	`;
	const data = await hasuraQuery(query, {});
	const rows = (data?.magi_token_overview ?? []) as TokenOverviewRow[];
	return new Map(rows.map((row) => [row.contract_id, row]));
}

/**
 * Read a pool's asset/mapping binding from chain state. Returns the custom
 * side of the pair — its symbol and the token contract behind it — or null
 * when the pool has no custom side or its state is unreadable.
 */
async function fetchPoolTokenBinding(
	poolContractId: string
): Promise<{ symbol: string; contractId: string } | null> {
	try {
		const res = await queryOnce(new GetStateByKeysStore(), {
			variables: { contractId: poolContractId, keys: [...POOL_BINDING_KEYS] },
			policy: 'NetworkOnly'
		});
		const state = (res.data?.getStateByKeys ?? {}) as Record<string, string | null | undefined>;
		for (const [nameKey, mapKey] of [
			['a0n', 'a0m'],
			['a1n', 'a1m']
		] as const) {
			const symbol = state[nameKey]?.trim();
			const contractId = state[mapKey]?.trim();
			// A native side has an empty mapping contract; a custom side always
			// carries one. Require both so a half-written pool is skipped rather
			// than surfaced as an unswappable entry.
			if (symbol && contractId && !isNativeAsset(symbol)) {
				return { symbol: symbol.toLowerCase(), contractId };
			}
		}
		return null;
	} catch (err) {
		console.error('Failed to read pool token binding', poolContractId, err);
		return null;
	}
}

async function fetchCustomTokensUncoalesced(): Promise<CustomToken[]> {
	try {
		const [registry, overview] = await Promise.all([fetchPoolRegistry(), fetchTokenOverview()]);

		const customPools = registry.filter((entry) => entry.symbols.some((s) => !isNativeAsset(s)));
		if (customPools.length === 0) return [];

		const bindings = await Promise.all(
			customPools.map(async (entry) => ({
				poolContractId: entry.contractId,
				binding: await fetchPoolTokenBinding(entry.contractId)
			}))
		);

		const out: CustomToken[] = [];
		const seen = new Set<string>();
		for (const { poolContractId, binding } of bindings) {
			if (!binding) continue;
			const meta = overview.get(binding.contractId);
			// A token the indexer doesn't know, or one its owner has paused,
			// must not be offered: transfers on a paused contract abort.
			if (!meta || meta.paused) continue;
			// First pool wins if a symbol somehow has two — the alternative is
			// showing two identical-looking entries the user can't tell apart.
			if (seen.has(binding.symbol)) continue;
			seen.add(binding.symbol);

			const decimals = Number(meta.decimals);
			out.push({
				symbol: binding.symbol,
				label: (meta.symbol || binding.symbol).toUpperCase(),
				name: meta.name || meta.symbol || binding.symbol,
				decimals: Number.isFinite(decimals) && decimals >= 0 ? decimals : 0,
				contractId: binding.contractId,
				poolContractId
			});
		}
		out.sort((a, b) => a.label.localeCompare(b.label));
		return out;
	} catch (err) {
		console.error('Failed to fetch custom tokens', err);
		return [];
	}
}

// Discovery is read by the swap picker, the balance layer and the broadcast
// path, all of which may ask at once on a single page load. Share one
// in-flight request; drop it as soon as it settles so nothing goes stale.
let inFlight: Promise<CustomToken[]> | null = null;

/** Pool-backed custom tokens, sorted by symbol. Never throws. */
export function fetchCustomTokens(): Promise<CustomToken[]> {
	if (inFlight) return inFlight;
	inFlight = fetchCustomTokensUncoalesced().finally(() => {
		inFlight = null;
	});
	return inFlight;
}
