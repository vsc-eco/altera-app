import { HoudiniClient } from '$houdini';
import { GQL_URL } from '$env/static/public';

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
