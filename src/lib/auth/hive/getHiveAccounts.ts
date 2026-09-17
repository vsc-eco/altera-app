import { getAccounts } from '@aioha/aioha/build/rpc';
import { resolveNodeUrl } from '$lib/nodeSelection/select';

/**
 * Aioha's standalone `getAccounts()` defaults to a hardcoded RPC
 * (`techcoderx.com`, which is currently down and exposes no CORS headers).
 * This wrapper passes our configured Hive node instead, so account lookups
 * respect the user's node choice and hit a reachable, CORS-friendly endpoint.
 */
export function getHiveAccounts(usernames: string[]) {
	const node = resolveNodeUrl('hive');
	return getAccounts(usernames, node);
}
