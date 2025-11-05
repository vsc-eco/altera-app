import { postingMetadataFromString, type PostingMetadata } from './accountTypes';
import { DHive } from '$lib/magiTransactions/dhive';
import type { ExtendedAccount, Account } from '@hiveio/dhive';
import { getUsernameFromDid } from '$lib/getAccountName';

// Cache types
const cached: Record<string, Account> = {};
const profileImageCache: Record<string, string | null> = {};
let pending: Record<string, Array<(value: Account | null) => void>> = {};
let pendingReqId: NodeJS.Timeout | undefined;

type ImageSize = 'small' | 'medium' | 'large';

// Enhanced version that returns optimized image URLs or null
export async function getProfilePicUrl(
	did: string,
	size: ImageSize = 'small'
): Promise<string | null> {
	const username = getUsernameFromDid(did);
	if (did.startsWith('did:pkh:eip155:1')) {
		return `https://effigy.im/a/${username}.svg`;
	}
	if (username.length > 16) return null;

	const cacheKey = `${username}-${size}`;

	// Check if we already know the profile image status
	if (cacheKey in profileImageCache) {
		return profileImageCache[cacheKey];
	}

	// Use existing batched account fetching
	const account = await getBatchedAccount(username);

	if (!account?.posting_json_metadata) {
		profileImageCache[cacheKey] = null;
		return null;
	}

	try {
		const metadata = postingMetadataFromString(account.posting_json_metadata);
		const hasProfileImage = metadata.profile?.profile_image;

		if (hasProfileImage) {
			// User has a profile image, return optimized URL
			const optimizedUrl = `https://images.hive.blog/u/${username}/avatar/${size}`;
			profileImageCache[cacheKey] = optimizedUrl;
			return optimizedUrl;
		} else {
			// User has no profile image
			profileImageCache[cacheKey] = null;
			return null;
		}
	} catch (e) {
		console.error('Error parsing profile metadata:', e);
		profileImageCache[cacheKey] = null;
		return null;
	}
}

// Your existing batched account fetcher (slightly cleaned up)
async function getBatchedAccount(username: string): Promise<Account | null> {
	if (username in cached) return cached[username];

	let resolve: (value: Account | null) => void;
	const promise = new Promise<Account | null>((res) => (resolve = res));

	if (pending[username]) {
		pending[username].push(resolve!);
	} else {
		pending[username] = [resolve!];
	}

	if (pendingReqId != undefined) {
		clearTimeout(pendingReqId);
	}

	pendingReqId = setTimeout(async () => {
		// Filter out already cached accounts
		const usernamesToFetch = Object.keys(pending).filter((key) => !(key in cached));

		if (usernamesToFetch.length === 0) {
			// All requested accounts are now cached
			for (const [username, resolvers] of Object.entries(pending)) {
				resolvers.forEach((resolver) => resolver(cached[username]));
			}
			pending = {};
			return;
		}

		try {
			const result = await DHive.database.getAccounts(usernamesToFetch);
			const accs = { result };

			// Cache the results
			accs.result.forEach((acc: ExtendedAccount) => {
				cached[acc.name] = acc;
			});

			// Resolve all pending promises
			for (const [username, resolvers] of Object.entries(pending)) {
				const account = cached[username];
				resolvers.forEach((resolver) => resolver(account));
			}

			pending = {};
		} catch (error) {
			console.error('Error fetching accounts:', error);

			// Resolve with null for failed requests
			for (const [username, resolvers] of Object.entries(pending)) {
				resolvers.forEach((resolver) => resolver(null));
			}

			pending = {};
		}
	}, 20);

	return promise;
}
