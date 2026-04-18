import { isVscTestnet } from '../client';

export const vscGateway = 'vsc.gateway';
export const v4vApp = 'v4v.app';
export const numberFormatLanguage = 'en-US';

// BTC mapping contract — single source of truth for every map/unmap/approve/
// balance-lookup call across the app. Network-switched via isVscTestnet().
export const BTC_MAPPING_CONTRACT_ID = isVscTestnet()
	? 'vsc1BkWohDf5fPcwn7V9B9ar6TyiWc3A2ZGJ4t'
	: 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d';

export function getVscExplorerTxUrl(txId: string): string {
	const base = isVscTestnet() ? 'https://magi-test.techcoderx.com' : 'https://vsc.techcoderx.com';
	return `${base}/tx/${txId}`;
}

export function getMemPoolTxUrl(btcTxId: string): string {
	const network = isVscTestnet() ? '/testnet' : '';
	return `https://mempool.space${network}/tx/${btcTxId}`;
}
