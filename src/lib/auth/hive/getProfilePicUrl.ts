import { getAccounts } from '@aioha/aioha/build/rpc';
import { postingMetadataFromString, type Account } from './accountTypes';

export async function getProfilePicUrl(username: string) {
	const res: Account = (await getAccounts([username])).result[0];
	if (res) return postingMetadataFromString(res.posting_json_metadata).profile.profile_image;
}
