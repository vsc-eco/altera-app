import { browser } from '$app/environment';
import { HoudiniClient } from '$houdini';
// const DEFAULT_GQL_URL="http://localhost:8080" // for running backend locally
export const DEFAULT_GQL_URL = 'https://api.vsc.eco';

export const keyVscGql = 'vsc-gql-url';
export const keyVscNetworkId = 'vsc-network-id';
export const keyTests = 'prefs-tests';
export const keyTbd = 'prefs-tbd';

const DEFAULT_VSC_NET_ID = 'vsc-mainnet';

export const currentGqlUrl =
	(browser && localStorage.getItem(keyVscGql)) || DEFAULT_GQL_URL;

export const vscNetworkId =
	(browser && localStorage.getItem(keyVscNetworkId)) || DEFAULT_VSC_NET_ID;

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
