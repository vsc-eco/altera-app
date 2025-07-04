import { getAccounts } from '@aioha/aioha/build/rpc';
import { postingMetadataFromString, type Account, type PostingMetadata } from './accountTypes';

const pending: { [username: string]: ((value: Account) => void)[] } = {};
let pendingReqId: NodeJS.Timeout | undefined = undefined;
const cached: { [username: string]: string } = {};
export async function getProfilePicUrl(username: string): Promise<string | undefined> {
	if (username.length > 16) {
		return `https://effigy.im/a/${username}.svg`;
	}
	// return `https://images.hive.blog/u/${username}/avatar/small`
	if (username in cached) return cached[username];
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
	let batchScheduled = false;

	if (!batchScheduled) {
		batchScheduled = true;
		Promise.resolve().then(async () => {
			batchScheduled = false;
			for (const key in pending) {
				if (key in cached) {
					delete pending[key];
					return cached[key];
				}
			}
			const accs = await getAccounts(Object.keys(pending).toSorted());
			accs.result.map((acc: Account) => {
				if (pending[acc.name]) pending[acc.name].forEach((fn) => fn(acc));
				delete pending[acc.name];
			});
		});
	}
	let res = await out;
	if (!res.posting_json_metadata) return;
	try {
		const out = postingMetadataFromString(res.posting_json_metadata).profile.profile_image;
		if (out) cached[username] = out;
		return out;
	} catch (e) {
		console.error(e);
	}
}
