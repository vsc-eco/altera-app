import { browser } from '$app/environment';
import { indexerNodes, vscApiNodes, hiveRpcNodes } from './env';
import { probeIndexer, probeVscApi, probeHiveRpc } from './probes';

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
const PROBE: Record<Category, (n: string[]) => Promise<string>> = {
	indexer: probeIndexer,
	vsc: probeVscApi,
	hive: probeHiveRpc
};

function ls(): Storage | null {
	try {
		if (!browser || typeof localStorage === 'undefined') return null;
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

/** Synchronous resolution for module-load consumers (client.ts/dhive.ts).
 *  Precedence: manual (if manual mode) → auto cache → first env node. */
export function resolveNodeUrl(cat: Category): string {
	const s = ls();
	if (s && isManualMode(cat)) {
		const manual = s.getItem(MANUAL_KEY[cat]);
		if (manual && manual.trim()) return manual.trim();
	}
	const cached = s?.getItem(CACHE_KEY[cat]);
	if (cached && cached.trim()) return cached.trim();
	return NODES[cat][0];
}

function isFresh(cat: Category): boolean {
	const raw = ls()?.getItem(CACHE_TS_KEY[cat]);
	if (!raw) return false;
	const ts = Number(raw);
	return Number.isFinite(ts) && Date.now() - ts < TTL_MS;
}

/** Background probe + cache write. No-op when manual, cache fresh, or no
 *  storage. Failures leave the previous cache untouched. */
export async function refreshNode(cat: Category): Promise<void> {
	const s = ls();
	if (!s || isManualMode(cat) || isFresh(cat)) return;
	try {
		const url = await PROBE[cat](NODES[cat]);
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
