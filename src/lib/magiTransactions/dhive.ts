import { Client, type ClientOptions } from '@hiveio/dhive';
import { browser } from '$app/environment';
import { resolveNodeUrl } from '$lib/nodeSelection/select';
import { hiveRpcNodes } from '$lib/nodeSelection/env';

export const keyHiveApiList = 'hive-api';
export const keyHiveApiAllowBackups = 'hive-api-allow-backup';
export const keyHiveNetworkId = 'hive-network-id';

// export const DEFAULT_HIVE_APIS = [
// 	'https://api.hive.blog',
// 	'https://api.hivekings.com',
// 	'https://anyx.io',
// 	'https://api.openhive.network'
// ];

export const DEFAULT_HIVE_APIS = [
	(browser && localStorage.getItem(keyHiveApiList)) || 'https://api.hive.blog'
];

const urls: string[] = (() => {
	const primary = browser ? resolveNodeUrl('hive') : 'https://api.hive.blog';
	const allowBackupStr = browser && localStorage.getItem(keyHiveApiAllowBackups);
	const allowBackups = allowBackupStr ? allowBackupStr === 'true' : true;
	if (!allowBackups) return [primary];
	return Array.from(new Set([primary, ...hiveRpcNodes]));
})();

const opts: ClientOptions = {
	chainId: (browser && localStorage.getItem(keyHiveNetworkId)) || undefined
};

export const DHive = new Client(urls, opts);
