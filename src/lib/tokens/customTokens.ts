/**
 * Discovery of Magi custom tokens (`magi_token-contract` instances) that are
 * actually tradeable — i.e. that have a registered DEX pool.
 *
 * Three traps this module exists to handle:
 *
 * 1. **Symbols are not unique.** Mainnet has two contracts both claiming
 *    `LASSECASH`; only one is bound to the live pool. The DEX router names
 *    assets by SYMBOL in `asset_in`/`asset_out`, but `approve` has to target
 *    the token CONTRACT — so we need both, and we have to resolve the contract
 *    from the pool rather than from the token registry.
 * 2. **The registry lists tokens with no pool** (DIY, FERNLET today). Those
 *    can't be swapped: there's nothing to route through.
 * 3. **A pool existing is NOT the same as the router knowing about it.**
 *    `dex_pool_registry` is the INDEXER's view. Swaps execute on the DEX
 *    router, which resolves assets and pools from its OWN state
 *    (`asset-<symbol>` and `pool-<a>-<b>`; note the `-` path delimiter).
 *    Those keys are written by `register_token` / `register_pool`, both signed
 *    by the router owner and easily forgotten after a pool is deployed and
 *    seeded. Mainnet's HBD:LASSECASH pool is live and funded yet unregistered
 *    as of 2026-09-09 — trusting the indexer alone would offer a token whose
 *    every swap aborts.
 *
 * So a token is only surfaced when the whole chain holds: the pool binds it
 * (`a0n`/`a1n` name the pair, `a0m`/`a1m` give the mapping contract, empty for
 * a native side), the pool points back at OUR router (`rtr`), and that router
 * has both the asset and the pool registered.
 */

import { GetStateByKeysStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { hasuraQuery } from '$lib/indexer/query';
import { fetchPoolRegistry } from '$lib/indexer/poolQueries';
import { isNativeAsset } from '$lib/pools/assets';
import { DEX_ROUTER_CONTRACT_ID } from '../../client';
import { fetchRouterRegistrations } from '$lib/pools/routerRegistry';
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
	/** True when the DEX router holds both `asset-<symbol>` and `pool-<a>-<b>`
	 *  for this token — i.e. swaps and liquidity ops can actually execute.
	 *  False means the pool exists and holds funds but the router can't route
	 *  it (register_token / register_pool never run). */
	routerRegistered: boolean;
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

/** Pool state: pair asset names, their mapping contracts, and the router the
 *  pool is bound to. A pool wired to a superseded router rejects our router's
 *  pre-deposited transfers, so its swaps fail however healthy the reserves look. */
const POOL_BINDING_KEYS = ['a0n', 'a1n', 'a0m', 'a1m', 'rtr'] as const;

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
type PoolBinding = {
	symbol: string;
	contractId: string;
	/** The pair in the pool's own normalised order, for the router's pool key. */
	pair: [string, string];
};

async function fetchPoolTokenBinding(poolContractId: string): Promise<PoolBinding | null> {
	try {
		const res = await queryOnce(new GetStateByKeysStore(), {
			variables: { contractId: poolContractId, keys: [...POOL_BINDING_KEYS] },
			policy: 'NetworkOnly'
		});
		const state = (res.data?.getStateByKeys ?? {}) as Record<string, string | null | undefined>;

		// A pool bound to a different (usually superseded) router can't serve
		// swaps issued against ours.
		if (state['rtr']?.trim() !== DEX_ROUTER_CONTRACT_ID) return null;

		const asset0 = state['a0n']?.trim();
		const asset1 = state['a1n']?.trim();
		if (!asset0 || !asset1) return null;

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
				return {
					symbol: symbol.toLowerCase(),
					contractId,
					pair: [asset0.toLowerCase(), asset1.toLowerCase()]
				};
			}
		}
		return null;
	} catch (err) {
		console.error('Failed to read pool token binding', poolContractId, err);
		return null;
	}
}

/**
 * Flag each candidate with whether the DEX router can actually route its pool.
 *
 * Shares `fetchRouterRegistrations` with the pools table, so "can the router
 * reach this pool" has exactly one implementation — swaps and liquidity are
 * blocked by the same missing registration, and must not be able to disagree.
 */
type Candidate = { poolContractId: string; binding: PoolBinding };

async function markRouterRegistered(
	candidates: Candidate[]
): Promise<Array<Candidate & { routerRegistered: boolean }>> {
	if (candidates.length === 0) return [];
	const regs = await fetchRouterRegistrations(
		candidates.map((c) => ({ contractId: c.poolContractId, symbols: c.binding.pair }))
	);
	return candidates.map((c) => {
		const reg = regs.get(c.poolContractId);
		if (!reg?.registered) {
			console.warn(
				`Custom token ${c.binding.symbol.toUpperCase()} is not routable on the DEX router ` +
					`(${reg?.missing ?? 'unknown'}). Its pool exists, but swaps and liquidity ops ` +
					`through the router would abort.`
			);
		}
		return { ...c, routerRegistered: reg?.registered === true };
	});
}

async function fetchPoolTokensUncoalesced(): Promise<CustomToken[]> {
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

		const bound = bindings.filter((b): b is Candidate => b.binding !== null);
		const marked = await markRouterRegistered(bound);

		const out: CustomToken[] = [];
		const seen = new Set<string>();
		for (const { poolContractId, binding, routerRegistered } of marked) {
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
				poolContractId,
				routerRegistered
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

/**
 * EVERY pool-backed custom token, whether or not the router can route it.
 *
 * Use this for DISPLAY — decimals, icons, labels. A pool's numbers must render
 * correctly even while its router registration is missing, otherwise an
 * unregistered token silently falls back to HIVE's icon and 3 decimal places.
 * Never throws.
 */
export function fetchPoolTokens(): Promise<CustomToken[]> {
	if (inFlight) return inFlight;
	inFlight = fetchPoolTokensUncoalesced().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

/** Only the tokens the DEX router can actually route — for SWAPS and any other
 *  operation that goes through the router. */
export async function fetchCustomTokens(): Promise<CustomToken[]> {
	return (await fetchPoolTokens()).filter((t) => t.routerRegistered);
}

/** Decimals by lowercase symbol, for formatting pool amounts. Custom tokens
 *  are not all 3 dp — LASSECASH is 8 — and getting this wrong misreports
 *  reserves and price ratios by orders of magnitude. */
export async function fetchTokenDecimals(): Promise<Record<string, number>> {
	const tokens = await fetchPoolTokens();
	return Object.fromEntries(tokens.map((t) => [t.symbol, t.decimals]));
}
