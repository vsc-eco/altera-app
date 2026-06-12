import { Client, type ClientOptions } from '@hiveio/dhive';
import { browser } from '$app/environment';
import { resolveNodeUrl } from '$lib/nodeSelection/select';
import { hiveRpcNodes } from '$lib/nodeSelection/env';

export const keyHiveApiList = 'hive-api';
export const keyHiveApiAllowBackups = 'hive-api-allow-backup';
export const keyHiveNetworkId = 'hive-network-id';

// localStorage access that never throws at module-evaluation time — some
// environments (jsdom Vitest client project) expose a localStorage global
// without a callable getItem. Mirrors client.ts's lsGet.
function lsGet(key: string): string | null {
	try {
		return globalThis.localStorage?.getItem?.(key) ?? null;
	} catch {
		return null;
	}
}

// export const DEFAULT_HIVE_APIS = [
// 	'https://api.hive.blog',
// 	'https://api.hivekings.com',
// 	'https://anyx.io',
// 	'https://api.openhive.network'
// ];

export const DEFAULT_HIVE_APIS = [
	(browser && lsGet(keyHiveApiList)) || 'https://api.hive.blog'
];

const urls: string[] = (() => {
	const primary = browser ? resolveNodeUrl('hive') : 'https://api.hive.blog';
	const allowBackupStr = browser && lsGet(keyHiveApiAllowBackups);
	const allowBackups = allowBackupStr ? allowBackupStr === 'true' : true;
	if (!allowBackups) return [primary];
	return Array.from(new Set([primary, ...hiveRpcNodes]));
})();

const opts: ClientOptions = {
	chainId: (browser && lsGet(keyHiveNetworkId)) || undefined
};

export const DHive = new Client(urls, opts);
