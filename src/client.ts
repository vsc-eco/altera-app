import { browser } from '$app/environment';
import { HoudiniClient } from '$houdini';
import { resolveNodeUrl } from '$lib/nodeSelection/select';
// const DEFAULT_GQL_URL="http://localhost:8080" // for running backend locally
export const DEFAULT_GQL_URL = 'https://api.vsc.eco';

export const keyVscGql = 'vsc-gql-url';
export const keyVscNetworkId = 'vsc-network-id';
export const keyMagiIndexer = 'magi-indexer-url';
export const keyTests = 'prefs-tests';
export const keyTbd = 'prefs-tbd';

const DEFAULT_VSC_NET_ID = 'vsc-mainnet';

/** Default Magi indexer (Hasura) base URL — same as okinoko/prod.
 *  The `/v1/graphql` path is appended by the GraphQL proxy route. */
export const DEFAULT_MAGI_INDEXER_URL = 'https://indexer.magi.milohpr.com';

/** DEX Router contract — routes swaps and BTC/HBD liquidity deposits.
 *  Network-switched between mainnet and testnet. */
export const DEX_ROUTER_CONTRACT_ID = (() => {
	const isTestnet = (browser && localStorage.getItem(keyVscNetworkId)) === 'vsc-testnet';
	return isTestnet
		? 'vsc1BmjY9JwFQyvRwYhLpiXFCYeUqxmU8ykrAM'
		: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45';
})();

export const currentGqlUrl = browser ? resolveNodeUrl('vsc') : DEFAULT_GQL_URL;

export const vscNetworkId =
	(browser && localStorage.getItem(keyVscNetworkId)) || DEFAULT_VSC_NET_ID;

/** True when the configured VSC network is the testnet. */
export const isVscTestnet = (): boolean => vscNetworkId === 'vsc-testnet';

/** Configured Magi indexer base URL — falls back to okinoko/prod.
 *  The GraphQL path is appended by the proxy route, not here. */
export const getMagiIndexerBaseUrl = (): string =>
	browser ? resolveNodeUrl('indexer') : DEFAULT_MAGI_INDEXER_URL;

/** Display unit for Hive (e.g. TESTS on testnet). Use for UI only. */
export const getHiveAssetName = (): string => (browser && localStorage.getItem(keyTests)) || 'HIVE';
/** Display unit for HBD (e.g. TBD on testnet). Use for UI only. */
export const getHbdAssetName = (): string => (browser && localStorage.getItem(keyTbd)) || 'HBD';

/**
 * Same-origin GraphQL proxy endpoint. The browser POSTs here instead of
 * hitting the upstream node directly, so the audit-tightened CORS on the
 * backend no longer blocks non-default nodes. The chosen node is passed via
 * the `x-gql-upstream` header (see routes/api/gql/+server.ts).
 */
export const GQL_PROXY_VSC = '/api/gql?service=vsc';
export const GQL_PROXY_INDEXER = '/api/gql?service=indexer';

/** Header carrying the chosen upstream node base URL to the GQL proxy. */
export function gqlUpstreamHeaders(base: string): Record<string, string> {
	return { 'content-type': 'application/json', 'x-gql-upstream': base };
}

export default new HoudiniClient({
	url: GQL_PROXY_VSC,
	// Inject the chosen VSC node as the upstream the proxy should forward to.
	fetchParams() {
		return {
			headers: { 'x-gql-upstream': currentGqlUrl }
		};
	}
});
