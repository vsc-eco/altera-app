import { getAccounts } from '@aioha/aioha/build/rpc';
import {
	type Account,
	type PostingMetadata,
	postingMetadataFromString
} from '$lib/auth/hive/accountTypes';
import { getUsernameFromDid } from '$lib/getAccountName';

export async function getDisplayName(did: string) {
	if (!did.startsWith('hive:')) {
		return;
	}
	const accountInfo: Account = (await getAccounts([getUsernameFromDid(did)])).result[0];
	if (!accountInfo?.posting_json_metadata) {
		return;
	}
	const postingMetadata = postingMetadataFromString(accountInfo.posting_json_metadata).profile;
	if (postingMetadata['name']) {
		return postingMetadata['name'];
	}
}
