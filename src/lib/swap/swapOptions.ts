import type { Auth } from '../auth/store';

const always: Enabled = () => true;
const never: Enabled = () => false;

const nothingSelected: Enabled = (from, to) => {
	return from == undefined && to == undefined;
};

type Source = { coin?: Coin; network?: Network };

const eitherNetworkEquals = (from: Source | undefined, to: Source | undefined, value: Network) => {
	return from?.network == value || to?.network == value;
};

const coinIsOneOf = (source: Source | undefined, arr: Coin[]) => {
	return !(source?.coin && !arr.includes(source.coin));
};

const hive: Coin = {
	value: 'hive',
	label: 'Hive',
	icon: '/hive/hive.svg',
	enabled: (going) => {
		return going == 'to';
	}
};
const hbd: Coin = {
	value: 'hbd',
	label: 'HBD',
	icon: '/hive/hbd.svg',
	enabled: (going) => {
		return going == 'to';
	}
};
const btc: Coin = {
	value: 'btc',
	label: 'BTC',
	icon: '/btc/btc.svg',
	enabled: (going, from, to) => {
		return going == 'from';
	}
};

export const Coin = {
	hive,
	hbd,
	btc
};

type Coin = {
	value: string;
	label: string;
	icon: string;
	enabled: Enabled;
};
type Enabled = (
	going: 'to' | 'from',
	from: { coin?: Coin; network?: Network } | undefined,
	to: { coin?: Coin; network?: Network } | undefined,
	auth: Auth
) => boolean;

const vsc: Network = {
	value: 'vsc',
	label: 'VSC',
	icon: '/vsc.png',
	enabled: (going, from, to) => {
		return true;
	}
};
const hiveMainnet: Network = {
	value: 'hive_mainnet',
	label: 'Hive Mainnet',
	icon: '/hive/hive.svg',
	enabled: always
};
export type Network = Coin;

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
	vsc
};

const swapOptions: {
	from: {
		coins: {
			coin: Coin;
			networks: Coin[];
			default?: Coin;
		}[];
	};
	to: {
		coins: {
			coin: Coin;
			networks: Network[];
			default?: Network;
		}[];
	};
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
