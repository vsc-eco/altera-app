import { browser } from '$app/environment';
import { nodesFor, GQL_PATH, type Category, type Network } from './env';
// APP-03/04: manual node overrides are gated against an allowlist. The list +
// validator live in ./allowlist so the GraphQL proxy server route can reuse
// the exact same SSRF guard.
import { isAllowedNodeUrl } from './allowlist';

export type { Category, Network };

const TTL_MS = 5 * 60 * 1000;

/** Set by the network toggle; mirrors `keyVscNetworkId` in src/client.ts.
 *  Read directly rather than imported so this module stays free of a cycle
 *  (client.ts imports resolveNodeUrl from here). */
const NETWORK_KEY = 'vsc-network-id';

const CACHE_KEY: Record<Category, string> = {
	indexer: 'node-auto-indexer',
	vsc: 'node-auto-vsc',
	hive: 'node-auto-hive'
};
const CACHE_TS_KEY: Record<Category, string> = {
	indexer: 'node-auto-ts-indexer',
	vsc: 'node-auto-ts-vsc',
	hive: 'node-auto-ts-hive'
};
export const MODE_KEY: Record<Category, string> = {
	indexer: 'node-mode-indexer',
	vsc: 'node-mode-vsc',
	hive: 'node-mode-hive'
};
/** Existing manual-override localStorage keys (keyMagiIndexer / keyVscGql /
 *  keyHiveApiList). Kept in sync with src/client.ts + dhive.ts. */
const MANUAL_KEY: Record<Category, string> = {
	indexer: 'magi-indexer-url',
	vsc: 'vsc-gql-url',
	hive: 'hive-api'
};

function ls(): Storage | null {
	try {
		// Some environments (jsdom Vitest client project) expose a
		// `localStorage` global that isn't a full Storage implementation —
		// validate getItem is callable, not just that the global exists.
		if (!browser || typeof localStorage === 'undefined') return null;
		if (typeof localStorage.getItem !== 'function') return null;
		return localStorage;
	} catch {
		return null;
	}
}

/** The VSC network currently selected in preferences. */
export function currentNetwork(): Network {
	return ls()?.getItem(NETWORK_KEY) === 'vsc-testnet' ? 'vsc-testnet' : 'vsc-mainnet';
}

/** Mainnet keeps the original cache keys so existing users keep their cache;
 *  testnet gets its own so the two networks never hand each other a node.
 *  Hive is not network-switched, so it is never suffixed. */
function scoped(key: string, cat: Category, network: Network): string {
	return cat !== 'hive' && network === 'vsc-testnet' ? `${key}-testnet` : key;
}

export function isManualMode(cat: Category): boolean {
	const s = ls();
	if (!s) return false;
	const mode = s.getItem(MODE_KEY[cat]);
	if (mode === 'manual') return true;
	// Legacy migration: users who set a custom endpoint before this feature
	// have the manual key populated but no explicit mode key. Treat that as
	// manual so auto-selection never silently discards their override.
	if (mode === null) {
		const legacy = s.getItem(MANUAL_KEY[cat]);
		return !!(legacy && legacy.trim());
	}
	return false;
}

/** The node auto-selection currently resolves to, ignoring any manual
 *  override: auto cache → first env node. Useful for showing the user what
 *  the dynamic node-finder picked even while a Custom override is active. */
export function autoSelectedNodeUrl(cat: Category): string {
	const network = currentNetwork();
	const cached = ls()?.getItem(scoped(CACHE_KEY[cat], cat, network));
	if (cached && cached.trim()) return cached.trim();
	return nodesFor(cat, network)[0];
}

/** Synchronous resolution for module-load consumers (client.ts/dhive.ts).
 *  Precedence: manual (if manual mode) → auto cache → first env node. */
export function resolveNodeUrl(cat: Category): string {
	const s = ls();
	if (s && isManualMode(cat)) {
		const manual = s.getItem(MANUAL_KEY[cat]);
		// APP-03/04: validate the user-controlled override before trusting it as
		// a GraphQL/indexer endpoint. Invalid/untrusted hosts fall through to
		// the safe default rather than throwing.
		if (manual && manual.trim() && isAllowedNodeUrl(manual.trim())) {
			return manual.trim();
		}
	}
	return autoSelectedNodeUrl(cat);
}

/** Every configured node for this category on the active network, the
 *  selected one first and the rest kept as failover.
 *
 *  Components that hand a node list to an SDK (the market and custom-token
 *  widgets) use this instead of spelling out endpoints, so they inherit the
 *  latency-ranked pick and a node is retired in one place — env.ts. */
export function orderedNodeUrls(cat: Category): string[] {
	const chosen = resolveNodeUrl(cat);
	const rest = nodesFor(cat, currentNetwork()).filter((n) => n !== chosen);
	return [chosen, ...rest];
}

/** orderedNodeUrls as full GraphQL endpoints, for SDKs that take absolute
 *  URLs rather than node bases. */
export function gqlEndpoints(cat: 'vsc' | 'indexer'): string[] {
	return orderedNodeUrls(cat).map((base) => base.replace(/\/+$/, '') + GQL_PATH[cat]);
}

/** Configured endpoints in their declared order, ignoring the latency
 *  ranking.
 *
 *  For lists where order encodes *which* backend is authoritative rather than
 *  which is fastest: the market/token SDKs fail over on error but NOT on an
 *  empty result, so the indexer that actually projects a contract's views
 *  must be tried first or a generic one answers "nothing found" and is
 *  believed. VSC nodes all serve the same chain state, so those are safe to
 *  rank by latency — use gqlEndpoints for them. */
export function configuredGqlEndpoints(cat: 'vsc' | 'indexer'): string[] {
	return nodesFor(cat, currentNetwork()).map((base) => base.replace(/\/+$/, '') + GQL_PATH[cat]);
}

function isFresh(cat: Category, network: Network): boolean {
	const raw = ls()?.getItem(scoped(CACHE_TS_KEY[cat], cat, network));
	if (!raw) return false;
	const ts = Number(raw);
	return Number.isFinite(ts) && Date.now() - ts < TTL_MS;
}

/** Background probe + cache write. No-op when manual, cache fresh, or no
 *  storage. Failures leave the previous cache untouched.
 *
 *  The probe runs server-side (/api/node-probe) rather than in the browser:
 *  Hive RPC and several indexer/VSC nodes don't expose CORS for our origin,
 *  so client-side probing always failed and spammed the console. Server-to-
 *  server has no CORS, so the ranking actually works. */
export async function refreshNode(cat: Category): Promise<void> {
	const s = ls();
	const network = currentNetwork();
	if (!s || isManualMode(cat) || isFresh(cat, network)) return;
	try {
		const res = await fetch(`/api/node-probe?category=${cat}&network=${network}`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const { url } = (await res.json()) as { url?: string };
		if (!url) throw new Error('no url in probe response');
		s.setItem(scoped(CACHE_KEY[cat], cat, network), url);
		s.setItem(scoped(CACHE_TS_KEY[cat], cat, network), String(Date.now()));
	} catch {
		/* keep previous cache; resolveNodeUrl falls through to env default */
	}
}

export function refreshAllNodes(): void {
	void refreshNode('indexer');
	void refreshNode('vsc');
	void refreshNode('hive');
}
