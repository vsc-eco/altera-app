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

const hive: Coin = { value: 'hive', label: 'Hive', icon: '/hive/hive.svg', enabled: always };
const hbd: Coin = { value: 'hbd', label: 'HBD', icon: '/hive/hbd.svg', enabled: always };
const btc: Coin = {
	value: 'btc',
	label: 'BTC',
	icon: '/btc/btc.svg',
	enabled: (going, from, to) => {
		if (going == 'from') {
			if (to?.network == vsc) {
				return false;
			}
			return to?.network != vsc;
		} else {
			// (going == 'to')
			if (from?.network == vsc) {
				return false;
			}
		}
		return true;
	}
};

const Coin = {
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
	from?: { coin?: Coin; network?: Network },
	to?: { coin?: Coin; network?: Network }
) => boolean;

const vsc: Network = {
	value: 'vsc',
	label: 'VSC',
	icon: '/vsc.png',
	enabled: (going, from, to) => {
		if (from?.coin == btc || to?.coin == btc) {
			return false;
		}
		if (going == 'to') {
			return from?.network != lightning;
		} else {
			//  (going == 'from')
			return to?.network != lightning;
		}
	}
};
const hiveMainnet: Network = {
	value: 'hive_mainnet',
	label: 'Hive Mainnet',
	icon: '/hive/hive.svg',
	enabled: (going, from, to) => {
		return true;
	}
};
type Network = Coin;

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
	enabled: (going, from, to) => {
		if (going == 'to') {
			return from?.network != vsc;
		} else {
			//  (going == 'from')
			return to?.network != vsc;
		}
	}
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
