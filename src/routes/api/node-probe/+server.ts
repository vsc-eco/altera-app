import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { indexerNodes, vscApiNodes, hiveRpcNodes } from '$lib/nodeSelection/env';
import { probeIndexer, probeVscApi, probeHiveRpc } from '$lib/nodeSelection/probes';

// The root layout sets `prerender = true`; opt out so this dynamic probe runs
// as a serverless function instead of being prerendered.
export const prerender = false;

/**
 * Server-side node health probe.
 *
 * The browser can't probe Hive RPC nodes (and several indexer/VSC nodes)
 * directly: they don't expose CORS headers for our origin, so every
 * client-side probe failed with a CORS error AND polluted the console on
 * every page load. Worse, the Hive auto-selection never actually worked in
 * the browser — it always fell through to the first env node.
 *
 * Running the probes server-to-server (where CORS doesn't apply) fixes both:
 * no console noise, and the freshness ranking is real. The browser just asks
 * "which node is freshest for this category?" and caches the answer.
 *
 *   GET /api/node-probe?category=indexer   (or vsc | hive)
 *   → { url: "<freshest node base URL>" }
 *
 * The candidate node lists come from server-controlled env config
 * (PUBLIC_*_NODES with hardcoded fallbacks), not from the caller, so there's
 * no SSRF surface here — a client can only pick a category, never a target.
 */

const NODES: Record<string, string[]> = {
	indexer: indexerNodes,
	vsc: vscApiNodes,
	hive: hiveRpcNodes
};

const PROBE: Record<string, (n: string[]) => Promise<string>> = {
	indexer: probeIndexer,
	vsc: probeVscApi,
	hive: probeHiveRpc
};

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category') ?? '';
	const nodes = NODES[category];
	const probe = PROBE[category];
	if (!nodes || !probe) {
		throw error(400, "category must be 'indexer', 'vsc', or 'hive'");
	}

	// probe* never rejects (Promise.allSettled inside); it falls back to
	// nodes[0] when nothing responds, so this can't throw under normal use.
	const best = await probe(nodes);
	return json({ url: best });
};
