import { getAccounts } from '@aioha/aioha/build/rpc';
import {
	type Account,
	postingMetadataFromString
} from '$lib/auth/hive/accountTypes';
import { getUsernameFromDid } from '$lib/getAccountName';
import { Network, type IntermediaryNetwork } from './sendOptions';

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

export function getRecipientNetworks(did: string): (IntermediaryNetwork | Network)[] {
	if (did.startsWith("hive:")) {
		return [Network.hiveMainnet, Network.vsc]
	}
	if (did.startsWith("did:pkh:eip155:1:")) {
		return [Network.vsc]
	}
	return [];
}