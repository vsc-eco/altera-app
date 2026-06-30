import { isVscTestnet } from '../client';

export const vscGateway = 'vsc.gateway';
export const v4vApp = 'v4v.app';
export const numberFormatLanguage = 'en-US';

// BTC mapping contract — single source of truth for every map/unmap/approve/
// balance-lookup call across the app. Network-switched via isVscTestnet().
export const BTC_MAPPING_CONTRACT_ID = isVscTestnet()
	? 'vsc1BkWohDf5fPcwn7V9B9ar6TyiWc3A2ZGJ4t'
	: 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d';

function vscExplorerBase(): string {
	return isVscTestnet() ? 'https://magi-test.techcoderx.com' : 'https://vsc.techcoderx.com';
}

export function getVscExplorerTxUrl(txId: string): string {
	return `${vscExplorerBase()}/tx/${txId}`;
}

/** VSC explorer home (shows the live block feed). Testnet-aware. */
export function getVscExplorerUrl(): string {
	return vscExplorerBase();
}

/** Hive L1 transaction on hivehub (e.g. governance vote/apply custom_json txs,
 *  which are Hive txs, not VSC ones). Hive has a single mainnet — no testnet switch. */
export function getHiveExplorerTxUrl(txId: string): string {
	return `https://hivehub.dev/tx/${txId}`;
}

/** A Hive account profile on hivehub (e.g. a validator/witness account). */
export function getHiveAccountUrl(account: string): string {
	const name = account.startsWith('hive:') ? account.slice(5) : account;
	return `https://hivehub.dev/@${encodeURIComponent(name)}`;
}

/** Direct Hive avatar CDN URL (no API call — serves a default if unset). Use for
 *  lightweight inline avatars; the async getProfilePicUrl resolves nicer images
 *  but costs a lookup per account. */
export function getHiveAvatarUrl(account: string, size: 'small' | 'icon' = 'small'): string {
	const name = account.startsWith('hive:') ? account.slice(5) : account;
	return `https://images.hive.blog/u/${encodeURIComponent(name)}/avatar/${size}`;
}

export function getMemPoolTxUrl(btcTxId: string): string {
	const network = isVscTestnet() ? '/testnet' : '';
	return `https://mempool.space${network}/tx/${btcTxId}`;
}
