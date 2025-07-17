import { getAccounts } from '@aioha/aioha/build/rpc';
import { type Account, postingMetadataFromString } from '$lib/auth/hive/accountTypes';
import { getUsernameFromDid } from '$lib/getAccountName';
import { Network, SendAccount, TransferMethod, type IntermediaryNetwork } from './sendOptions';

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
	if (did.startsWith('hive:')) {
		return [Network.hiveMainnet, Network.vsc];
	}
	if (did.startsWith('did:pkh:eip155:1:')) {
		return [Network.vsc];
	}
	return [];
}

export function getMethodNetworks(method: TransferMethod) {
	if (method.value === TransferMethod.vscTransfer.value) {
		return [Network.vsc, Network.hiveMainnet];
	} else if (method.value === TransferMethod.lightningTransfer.value) {
		return [Network.lightning];
	}
	return [];
}

type AccsNetsPair =
	| {
			accounts: SendAccount[];
			networks?: Network[];
	  }
	| undefined;

export function getFromOptions(
	method: TransferMethod | undefined,
	did: string | undefined
): AccsNetsPair {
	console.log("getfromopts", method, did);
	if (!method || !did) {
		return;
	}
	if (method.value === TransferMethod.vscTransfer.value) {
		let result: AccsNetsPair = { accounts: [SendAccount.vscAccount] };
		if (did.startsWith('hive:')) {
			result.accounts.push(SendAccount.deposit);
			result.networks = [Network.hiveMainnet];
		}
		return result;
	} else if (method.value === TransferMethod.lightningTransfer.value) {
		return {
			accounts: [SendAccount.swap],
			networks: [Network.lightning]
		};
	}
	return;
}
