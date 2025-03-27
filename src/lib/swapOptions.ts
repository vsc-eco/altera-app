const hive = { value: 'hive', label: 'Hive', icon: '/hive/hive.svg' };
const hbd = { value: 'hbd', label: 'HBD', icon: '/hive/hbd.svg' };
const btc = { value: 'btc', label: 'BTC', icon: '/btc/btc.svg' };

const Currency = {
	hive,
	hbd,
	btc
};

const vsc = { value: 'vsc', label: 'VSC', icon: '/vsc.png' };
const hiveMainnet = { value: 'hive_mainnet', label: 'Hive Mainnet', icon: '/hive/hive.svg' };

const btcMainnet = { value: 'btc_mainnet', label: 'BTC Mainnet', icon: '/btc/btc.svg' };
const lightning = { value: 'lightning', label: 'Lightning', icon: '/btc/lightning.svg' };

export default {
	from: {
		coins: [
			{
				coin: hive,
				networks: [vsc, hiveMainnet],
				default: vsc
			},
			{
				coin: hbd,
				networks: [vsc, hiveMainnet],
				default: vsc
			},
			{
				coin: btc,
				networks: [lightning, btcMainnet],
				default: lightning
			}
		]
	},
	to: {
		coins: [
			{
				coin: hive,
				networks: [vsc, hiveMainnet],
				default: vsc
			},
			{
				coin: hbd,
				networks: [vsc, hiveMainnet],
				default: vsc
			},
			{
				coin: btc,
				networks: [btcMainnet],
				default: btcMainnet
			}
		]
	}
};
