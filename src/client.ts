import { browser } from '$app/environment';
import { HoudiniClient } from '$houdini';
// const DEFAULT_GQL_URL="http://localhost:8080" // for running backend locally
export const DEFAULT_GQL_URL = 'https://api.vsc.eco';

export const keyVscGql = 'vsc-gql-url';
export const keyVscNetworkId = 'vsc-network-id';

const DEFAULT_VSC_NET_ID = 'vsc-mainnet';

export const currentGqlUrl =
	(browser && localStorage.getItem(keyVscGql)) || DEFAULT_GQL_URL || 'https://api.vsc.eco';

export const vscNetworkId =
	(browser && localStorage.getItem(keyVscNetworkId)) || DEFAULT_VSC_NET_ID;

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
