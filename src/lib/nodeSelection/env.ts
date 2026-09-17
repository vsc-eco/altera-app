// Dynamic (runtime) public env so a missing key is `undefined` instead of a
// hard build failure — the FALLBACK_* lists below cover the unset case, and
// production can supply these without committing an .env to the repo.
import { env } from '$env/dynamic/public';

export type Category = 'indexer' | 'vsc' | 'hive';
export type Network = 'vsc-mainnet' | 'vsc-testnet';

/** GraphQL path each service hangs off its node base URL. Single source of
 *  truth: the /api/gql proxy routes with it and the widget pages build their
 *  SDK endpoint lists from it, so no caller spells these out. */
export const GQL_PATH: Record<'vsc' | 'indexer', string> = {
	vsc: '/api/v1/graphql',
	indexer: '/v1/graphql'
};

export const FALLBACK_INDEXER_NODES = [
	'https://api.okinoko.io/hasura',
	'https://indexer.magi.milohpr.com'
];
export const FALLBACK_INDEXER_NODES_TESTNET = [
	// The okinoko indexer is the one kept configured for the market contract,
	// so it leads: SDK failover fires on error, never on an empty result, and
	// a generic indexer would answer "no listings" without ever failing over.
	'https://api-testnet.okinoko.io/hasura',
	'https://indexer.testnet.magi.milohpr.com'
];

// api.vsc.eco was removed 2026-09-17: the host still resolves (149.56.25.168)
// but no longer completes a TCP connect, so every request against it hangs
// until the client's own connect timeout instead of failing fast. As the first
// entry it was the cold-start default — a browser with no auto-select cache
// bound the whole session to a dead node before the probe could run.
// api.okinoko.io is first-party and serves the same VSC API at /api/v1/graphql.
export const FALLBACK_VSC_API_NODES = ['https://api.okinoko.io', 'https://vsc.techcoderx.com'];
export const FALLBACK_VSC_API_NODES_TESTNET = ['https://magi-test.techcoderx.com'];

// Hive has one mainnet, so this list is not network-switched (the VSC testnet
// still anchors to Hive L1). Probes run server-side, where CORS does not
// apply, so nodes that refuse browser preflight are still usable here.
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
export const indexerNodesTestnet = parseNodeList(
	env.PUBLIC_INDEXER_NODES_TESTNET,
	FALLBACK_INDEXER_NODES_TESTNET
);
export const vscApiNodes = parseNodeList(env.PUBLIC_VSC_API_NODES, FALLBACK_VSC_API_NODES);
export const vscApiNodesTestnet = parseNodeList(
	env.PUBLIC_VSC_API_NODES_TESTNET,
	FALLBACK_VSC_API_NODES_TESTNET
);
export const hiveRpcNodes = parseNodeList(env.PUBLIC_HIVE_RPC_NODES, FALLBACK_HIVE_RPC_NODES);

// Contract deployer service, per network. Lives here with the node lists so
// the widget pages hold no URLs of their own.
export const FALLBACK_DEPLOYER_URL = 'https://deploy.okinoko.io';
export const FALLBACK_DEPLOYER_URL_TESTNET = 'https://deploy-testnet.okinoko.io';

export function deployerUrlFor(network: Network): string {
	return network === 'vsc-testnet'
		? env.PUBLIC_DEPLOYER_URL_TESTNET || FALLBACK_DEPLOYER_URL_TESTNET
		: env.PUBLIC_DEPLOYER_URL || FALLBACK_DEPLOYER_URL;
}

/** Candidate nodes for a category on a given network. Every consumer —
 *  auto-selection, the probe route and the widget pages — reads its
 *  endpoints from here, so a node is added or retired in exactly one place. */
export function nodesFor(cat: Category, network: Network): string[] {
	const testnet = network === 'vsc-testnet';
	if (cat === 'indexer') return testnet ? indexerNodesTestnet : indexerNodes;
	if (cat === 'vsc') return testnet ? vscApiNodesTestnet : vscApiNodes;
	return hiveRpcNodes;
}
