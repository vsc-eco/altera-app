import { Client, type ClientOptions } from '@hiveio/dhive';
import { browser } from '$app/environment';

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
	const storedStr = browser && localStorage.getItem(keyHiveApiList);
	const allowBackupStr = browser && localStorage.getItem(keyHiveApiAllowBackups);
	if (storedStr) {
		const api: string = storedStr;
		const allowBackups: boolean = allowBackupStr ? allowBackupStr === 'true' : true;
		if (!allowBackups) {
			return [api];
		}
		return Array.from(new Set([api, ...DEFAULT_HIVE_APIS]));
	}
	return DEFAULT_HIVE_APIS;
})();

const opts: ClientOptions = {
	chainId: (browser && localStorage.getItem(keyHiveNetworkId)) || undefined
};

export const DHive = new Client(urls, opts);
