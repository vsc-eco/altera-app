import { HoudiniClient } from '$houdini';
// const GQL_URL="http://localhost:8080" // for running backend locally
const GQL_URL = 'https://api.vsc.eco';

export default new HoudiniClient({
	url: `${GQL_URL || 'https://api.vsc.eco'}/api/v1/graphql`

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
