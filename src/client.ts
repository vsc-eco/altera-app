import { browser } from '$app/environment';
import { HoudiniClient } from '$houdini';
// const DEFAULT_GQL_URL="http://localhost:8080" // for running backend locally
export const DEFAULT_GQL_URL = 'https://api.vsc.eco';

export const keyVscGql = 'vsc-gql-url';
export const keyVscNetworkId = 'vsc-network-id';
export const keyMagiIndexer = 'magi-indexer-url';
export const keyTests = 'prefs-tests';
export const keyTbd = 'prefs-tbd';

const DEFAULT_VSC_NET_ID = 'vsc-mainnet';

/** Default Magi indexer (Hasura) base URL — same as okinoko/prod.
 *  The Hasura `/v1/graphql` path is appended by getMagiIndexerUrl(). */
export const DEFAULT_MAGI_INDEXER_URL = 'https://indexer.magi.milohpr.com';

/** Standard Hasura GraphQL path suffix. */
export const HASURA_GRAPHQL_PATH = '/v1/graphql';

/** DEX Router contract — routes swaps and BTC/HBD liquidity deposits.
 *  Network-switched between mainnet and testnet. */
export const DEX_ROUTER_CONTRACT_ID = (() => {
	const isTestnet = (browser && localStorage.getItem(keyVscNetworkId)) === 'vsc-testnet';
	return isTestnet
		? 'vsc1BmjY9JwFQyvRwYhLpiXFCYeUqxmU8ykrAM'
		: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45';
})();

export const currentGqlUrl = (browser && localStorage.getItem(keyVscGql)) || DEFAULT_GQL_URL;

export const vscNetworkId =
	(browser && localStorage.getItem(keyVscNetworkId)) || DEFAULT_VSC_NET_ID;

/** True when the configured VSC network is the testnet. */
export const isVscTestnet = (): boolean => vscNetworkId === 'vsc-testnet';

/** Configured Magi indexer base URL — falls back to okinoko/prod. */
export const getMagiIndexerBaseUrl = (): string => {
	const stored = browser && localStorage.getItem(keyMagiIndexer);
	return stored || DEFAULT_MAGI_INDEXER_URL;
};

/** Fully-qualified Hasura GraphQL URL (base + /v1/graphql).
 *  Use this when you need to issue a query. */
export const getMagiIndexerUrl = (): string => {
	const base = getMagiIndexerBaseUrl().replace(/\/+$/, '');
	return base + HASURA_GRAPHQL_PATH;
};

/** Display unit for Hive (e.g. TESTS on testnet). Use for UI only. */
export const getHiveAssetName = (): string => (browser && localStorage.getItem(keyTests)) || 'HIVE';
/** Display unit for HBD (e.g. TBD on testnet). Use for UI only. */
export const getHbdAssetName = (): string => (browser && localStorage.getItem(keyTbd)) || 'HBD';

export default new HoudiniClient({
	url: currentGqlUrl + '/api/v1/graphql'

	// uncomment this to configure the network call (for things like authentication)
	// for more information, please visit here: https://www.houdinigraphql.com/guides/authentication
	// fetchParams({ session }) {
	//     return {
	//         headers: {
	//             Authentication: `Bearer ${session.token}`,
	//         }
	//     }
	// }
});
