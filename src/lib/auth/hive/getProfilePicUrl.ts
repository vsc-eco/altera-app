import { getAccounts } from '@aioha/aioha/build/rpc';
import { postingMetadataFromString, type Account, type PostingMetadata } from './accountTypes';

const pending: { [username: string]: ((value: Account) => void)[] } = {};
let pendingReqId: NodeJS.Timeout | undefined = undefined;
export async function getProfilePicUrl(username: string): Promise<string | undefined> {
	if (username.length > 16) return; // to avoid querying for eth addresses
	let resolve: (value: Account) => void;
	const out = new Promise<Account>((res) => (resolve = res));
	if (pending[username]) {
		// @ts-expect-error
		pending[username].push(resolve);
	} else {
		// @ts-expect-error
		pending[username] = [resolve];
	}
	if (pendingReqId != undefined) {
		clearTimeout(pendingReqId);
	}
	pendingReqId = setTimeout(async () => {
		const accs = await getAccounts(Object.keys(pending).toSorted());
		accs.result.map((acc: Account) => {
			console.log(acc, pending);
			if (pending[acc.name]) pending[acc.name].forEach((fn) => fn(acc));
			delete pending[acc.name];
		});
	}, 20);
	let res = await out;
	if (!res.posting_json_metadata) return;
	try {
		console.log('out:', postingMetadataFromString(res.posting_json_metadata).profile.profile_image);
		return postingMetadataFromString(res.posting_json_metadata).profile.profile_image;
	} catch (e) {
		console.log('HERE', res, username);
		console.error(e);
	}
}
