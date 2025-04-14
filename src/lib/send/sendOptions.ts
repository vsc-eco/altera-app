import type { Auth } from '../auth/store';
import { readonly, type Readable } from 'svelte/store';
const always: Enabled = () => true;
const never: Enabled = () => false;

const nothingSelected: Enabled = (from, to) => {
	return from == undefined && to == undefined;
};

export type CoinOnNetwork = { coin: Coin; network: Network };
const eitherNetworkEquals = (
	from: CoinOnNetwork | undefined,
	to: CoinOnNetwork | undefined,
	value: Network
) => {
	return from?.network == value || to?.network == value;
};

const coinIsOneOf = (source: CoinOnNetwork | undefined, arr: Coin[]) => {
	return !(source?.coin && !arr.includes(source.coin));
};

const hive: Coin = {
	value: 'hive',
	label: 'HIVE',
	icon: '/hive/hive.svg',
	unit: 'HIVE',
	enabled: (going, info) => {
		return true;
	},
	convertTo: []
};
const hbd: Coin = {
	value: 'hbd',
	label: 'HBD',
	icon: '/hive/hbd.svg',
	unit: 'HBD',
	enabled: (going, info) => {
		return true;
	},
	convertTo: []
};
const btc: Coin = {
	value: 'btc',
	label: 'BTC',
	icon: '/btc/btc.svg',
	unit: 'BTC',
	enabled: (going, from, to) => {
		return going == 'from';
	},
	convertTo: []
};

const usd: Coin = {
	value: 'usd',
	label: 'USD',
	icon: '/btc/btc.svg',
	unit: 'USD',
	enabled: never,
	convertTo: []
};

const sats: Coin = {
	value: 'SATS',
	label: 'SATS',
	icon: '/btc/btc.svg',
	unit: 'SATS',
	enabled: (going, from, to) => {
		return going == 'from';
	},
	convertTo: []
};

hive.convertTo = [hbd];

export const Coin = {
	hive,
	hbd,
	btc,
	sats,
	usd
};

export type Coin = {
	value: string;
	label: string;
	icon: string;
	unit: string;
	enabled: Enabled;
	convertTo: Coin[];
};

type Enabled = (
	going: 'to' | 'from',
	info: {
		from?: Partial<CoinOnNetwork> | undefined;
		to?: Partial<CoinOnNetwork> | undefined;
	},
	auth: Auth
) => boolean;

const vsc: Network = {
	value: 'vsc',
	label: 'VSC',
	icon: '/vsc.png',
	enabled: (going, { from, to }) => {
		if (from?.coin == undefined || to?.coin == undefined) return true;
		if (from?.coin == to?.coin) return true;
		if (from?.network == Network.lightning) return true;
		return false;
	}
};
const unknown: Network = {
	value: 'unk',
	label: 'Unknown',
	icon: '/unk.png',
	enabled: never
};
const hiveMainnet: Network = {
	value: 'hive_mainnet',
	label: 'Hive Mainnet',
	icon: '/hive/hive.svg',
	enabled: (going, { from, to }, auth) => {
		if (auth.value?.aioha == undefined) return false;
		if (from?.coin == undefined || to?.coin == undefined) return true;
		if (from?.coin == to?.coin) return true;
		if (from?.network == Network.lightning) return true;
		return false;
	}
};
export type Network = {
	value: string;
	label: string;
	icon: string;
	enabled: Enabled;
};

const btcMainnet: Network = {
	value: 'btc_mainnet',
	label: 'BTC Mainnet',
	icon: '/btc/btc.svg',
	enabled: never
};
const lightning: Network = {
	value: 'lightning',
	label: 'Lightning',
	icon: '/btc/lightning.svg',
	enabled: always
};

export const Network = {
	btcMainnet,
	lightning,
	hiveMainnet,
	vsc,
	unknown
};

export type CoinOptions = {
	coins: {
		coin: Coin;
		networks: Network[];
		default?: Coin;
	}[];
};

const swapOptions: {
	from: CoinOptions;
	to: CoinOptions;
} = {
	from: {
		coins: [
			{
				coin: hive,
				networks: [vsc, hiveMainnet]
			},
			{
				coin: hbd,
				networks: [vsc, hiveMainnet]
			},
			{
				coin: btc,
				networks: [lightning, btcMainnet]
			}
		]
	},
	to: {
		coins: [
			{
				coin: hive,
				networks: [vsc, hiveMainnet]
			},
			{
				coin: hbd,
				networks: [vsc, hiveMainnet]
			},
			{
				coin: btc,
				networks: [lightning, btcMainnet]
			}
		]
	}
};

export default swapOptions;
