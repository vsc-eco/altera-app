import {
	PUBLIC_INDEXER_NODES,
	PUBLIC_VSC_API_NODES,
	PUBLIC_HIVE_RPC_NODES
} from '$env/static/public';

export const FALLBACK_INDEXER_NODES = [
	'https://api.okinoko.io/hasura',
	'https://indexer.magi.milohpr.com'
];
export const FALLBACK_VSC_API_NODES = ['https://api.vsc.eco', 'https://vsc.techcoderx.com'];
export const FALLBACK_HIVE_RPC_NODES = [
	'https://api.hive.blog',
	'https://api.openhive.network',
	'https://techcoderx.com',
	'https://api.deathwing.me'
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

export const indexerNodes = parseNodeList(PUBLIC_INDEXER_NODES, FALLBACK_INDEXER_NODES);
export const vscApiNodes = parseNodeList(PUBLIC_VSC_API_NODES, FALLBACK_VSC_API_NODES);
export const hiveRpcNodes = parseNodeList(PUBLIC_HIVE_RPC_NODES, FALLBACK_HIVE_RPC_NODES);
