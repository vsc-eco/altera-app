// Dynamic (runtime) public env so a missing key is `undefined` instead of a
// hard build failure — the FALLBACK_* lists below cover the unset case, and
// production can supply these without committing an .env to the repo.
import { env } from '$env/dynamic/public';

export const FALLBACK_INDEXER_NODES = [
	'https://api.okinoko.io/hasura',
	'https://indexer.magi.milohpr.com'
];
export const FALLBACK_VSC_API_NODES = ['https://api.vsc.eco', 'https://vsc.techcoderx.com'];
// Dropped previously-listed nodes that are unreachable from the browser:
//   - techcoderx.com:    Hive node registry shows 0% uptime, no CORS
//   - api.deathwing.me:  recently returning 503, no CORS for our origin
// Both polluted the browser console with CORS errors on every probe. Kept
// only nodes with a recent track record of liveness (>= 97% per the public
// Hive node registry). First node is what the resolver falls back to when
// browser probes fail (which is currently always — Hive RPCs don't expose
// CORS for our origin). Users can still override via PUBLIC_HIVE_RPC_NODES.
export const FALLBACK_HIVE_RPC_NODES = [
	'https://api.hive.blog',
	'https://api.openhive.network',
	'https://api.c0ff33a.uk',
	'https://hapi.ecency.com',
	'https://api.syncad.com'
];

/** Parse a comma-separated node list; bare hosts get https://; trailing
 *  slashes stripped; falls back to `fallback` when the result is empty. */
export function parseNodeList(raw: string | undefined, fallback: string[]): string[] {
	const list = (raw ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.map((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
		.map((s) => s.replace(/\/+$/, ''));
	return list.length > 0 ? list : [...fallback];
}

export const indexerNodes = parseNodeList(env.PUBLIC_INDEXER_NODES, FALLBACK_INDEXER_NODES);
export const vscApiNodes = parseNodeList(env.PUBLIC_VSC_API_NODES, FALLBACK_VSC_API_NODES);
export const hiveRpcNodes = parseNodeList(env.PUBLIC_HIVE_RPC_NODES, FALLBACK_HIVE_RPC_NODES);
