import { browser } from '$app/environment';
import { indexerNodes, vscApiNodes, hiveRpcNodes } from './env';
// APP-03/04: manual node overrides are gated against an allowlist. The list +
// validator live in ./allowlist so the GraphQL proxy server route can reuse
// the exact same SSRF guard.
import { isAllowedNodeUrl } from './allowlist';

export type Category = 'indexer' | 'vsc' | 'hive';

const TTL_MS = 5 * 60 * 1000;

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
const NODES: Record<Category, string[]> = {
	indexer: indexerNodes,
	vsc: vscApiNodes,
	hive: hiveRpcNodes
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
	const cached = ls()?.getItem(CACHE_KEY[cat]);
	if (cached && cached.trim()) return cached.trim();
	return NODES[cat][0];
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

function isFresh(cat: Category): boolean {
	const raw = ls()?.getItem(CACHE_TS_KEY[cat]);
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
 *  server has no CORS, so the freshness ranking actually works. */
export async function refreshNode(cat: Category): Promise<void> {
	const s = ls();
	if (!s || isManualMode(cat) || isFresh(cat)) return;
	try {
		const res = await fetch(`/api/node-probe?category=${cat}`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const { url } = (await res.json()) as { url?: string };
		if (!url) throw new Error('no url in probe response');
		s.setItem(CACHE_KEY[cat], url);
		s.setItem(CACHE_TS_KEY[cat], String(Date.now()));
	} catch {
		/* keep previous cache; resolveNodeUrl falls through to env default */
	}
}

export function refreshAllNodes(): void {
	void refreshNode('indexer');
	void refreshNode('vsc');
	void refreshNode('hive');
}
