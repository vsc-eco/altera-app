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

/** VSC tx ids carry an operation index suffix ("<hiveTrxId>-1", "-2", ...) because
 *  one Hive transaction can hold several VSC ops. The block explorers index by the
 *  bare Hive transaction id, so a suffixed id 404s — strip it before linking.
 *  Leaves ids without a suffix (and 64-hex BTC txids) untouched. */
function bareTxId(txId: string): string {
	return txId.replace(/-\d+$/, '');
}

export function getVscExplorerTxUrl(txId: string): string {
	return `${vscExplorerBase()}/tx/${bareTxId(txId)}`;
}

/** VSC explorer home (shows the live block feed). Testnet-aware. */
export function getVscExplorerUrl(): string {
	return vscExplorerBase();
}

/** Hive L1 transaction on hivehub (e.g. governance vote/apply custom_json txs,
 *  which are Hive txs, not VSC ones). Hive has a single mainnet — no testnet switch. */
export function getHiveExplorerTxUrl(txId: string): string {
	return `https://hivehub.dev/tx/${bareTxId(txId)}`;
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

/**
 * Deposit swaps paid with Bitcoin carry refund_to (the sender's own hive:
 * account or Bitcoin address) and min_amount_out. Off until the BTC mapping
 * contract that refunds to refund_to is active on this network: the contract
 * before it honours min_amount_out but pays a swap that misses it to swap_to,
 * which may be a third party. Turn on with the contract upgrade, before the
 * mapping bot starts requiring refund_to.
 */
export const DEPOSIT_SWAP_REFUNDS_ACTIVE = false;

/**
 * Smallest deposit swap paid with Bitcoin, in sats: a failed swap's refund goes
 * home on Bitcoin with its miner fee taken from it. The contract prices one vault
 * input, the payment and change at ~187 vB, so 10,000 sats still clears dust (546)
 * at up to ~50 sat/vB; a refund that needs two vault inputs (~275 vB), up to ~34.
 */
export const MIN_BTC_DEPOSIT_SWAP_SATS = 10_000;
