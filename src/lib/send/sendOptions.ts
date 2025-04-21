import { convert } from '$lib/currency/convert';
import type { Auth } from '../auth/store';
import { readonly, type Readable } from 'svelte/store';
import { getV4VMetadata } from './v4v/api-types/metadata';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
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
		if (info.from?.network == Network.lightning) return true;
		if (info.from?.coin == undefined) return true;
		if (going == 'from') return true;
		if (info.from?.coin == Coin.hive) return true;
		return false;
	},
	decimalPlaces: 3
};
const hbd: Coin = {
	value: 'hbd',
	label: 'HBD',
	icon: '/hive/hbd.svg',
	unit: 'HBD',
	enabled: (going, info) => {
		if (info.from?.network == Network.lightning) return true;
		if (info.from?.coin == undefined) return true;
		if (going == 'from') return true;
		if (info.from?.coin == Coin.hbd) return true;
		return false;
	},
	decimalPlaces: 3
};
const btc: Coin = {
	value: 'btc',
	label: 'BTC',
	icon: '/btc/btc.svg',
	unit: 'BTC',
	enabled: (going, from, to) => {
		return going == 'from';
	},
	decimalPlaces: 8
};

const usd: Coin = {
	value: 'usd',
	label: 'USD',
	icon: '/btc/btc.svg',
	unit: 'USD',
	enabled: never,
	decimalPlaces: 2
};

const sats: Coin = {
	value: 'SATS',
	label: 'SATS',
	icon: '/btc/btc.svg',
	unit: 'SATS',
	enabled: (going, from, to) => {
		return going == 'from';
	},
	decimalPlaces: 0
};
const unk: Coin = {
	value: 'UNK',
	label: 'UNK',
	icon: '/unk.svg',
	unit: 'UNK',
	enabled: never,
	decimalPlaces: 8
};

export const Coin = {
	hive,
	hbd,
	btc,
	sats,
	usd,
	unk
};

export type Coin = {
	/**
	 * The value for a form submission
	 */
	value: string;
	/**
	 * The label to display in a form field (ex. radio group)
	 */
	label: string;
	/**
	 * A href for the icon of the coin
	 */
	icon: string;
	/**
	 * The text to display next to a currency (usually 3-4 letters for the currency)
	 */
	unit: string;
	/**
	 * A function which returns whether a currency is available to trade to/from
	 * based on the network and currency it's going to/from
	 */
	enabled: Enabled;
	/**
	 * Number of decimal places to use for arithmetic and display
	 */
	decimalPlaces: number;
};

type Enabled = (
	going: 'to' | 'from',
	info: {
		from?: Partial<CoinOnNetwork> | undefined;
		to?: Partial<CoinOnNetwork> | undefined;
	},
	auth: Auth
) => boolean;

const vsc: IntermediaryNetwork = {
	value: 'vsc',
	label: 'VSC',
	icon: '/vsc.png',
	enabled: (going, { from, to }) => {
		if (from?.coin == undefined || to?.coin == undefined) return true;
		if (from?.coin == to?.coin) return true;
		if (from?.network == Network.lightning) return true;
		return false;
	},
	feeCalculation: async (input: UnkCoinAmount, outputCoin: Coin) => {
		return new CoinAmount(0, outputCoin);
	}
};
const unknown: IntermediaryNetwork = {
	value: 'unk',
	label: 'Unknown',
	icon: '/unk.svg',
	enabled: never,
	feeCalculation: async (from: UnkCoinAmount, outputCoin: Coin) => {
		if (from.coin.value == outputCoin.value) {
			return new CoinAmount(0, from.coin); // no fee if going between same currency type
		}
		throw new Error('cannot calculate fees for an unknown intermediary network.');
	}
};
const hiveMainnet: IntermediaryNetwork = {
	value: 'hive_mainnet',
	label: 'Hive Mainnet',
	icon: '/hive/hive.svg',
	enabled: (going, { from, to }, auth) => {
		if (auth.value?.aioha == undefined && going == 'from') return false;
		if (from?.coin == undefined || to?.coin == undefined) return true;
		if (from?.coin == to?.coin) return true;
		if (from?.network == Network.lightning) return true;
		return false;
	},
	feeCalculation: async (from, outputCoin) => {
		return new CoinAmount(0, outputCoin);
	}
};

type FeeCalculation<FromCoinAmount extends UnkCoinAmount, ToCoin extends Coin> = (
	from: FromCoinAmount,
	outputCoin: ToCoin
) => Promise<CoinAmount<ToCoin>>;
export type Network = {
	value: string;
	label: string;
	icon: string;
	enabled: Enabled;
	feeCalculation?: FeeCalculation<UnkCoinAmount, Coin>;
};

export type IntermediaryNetwork = Network & { feeCalculation: FeeCalculation<UnkCoinAmount, Coin> };

const btcMainnet: Network = {
	value: 'btc_mainnet',
	label: 'BTC Mainnet',
	icon: '/btc/btc.svg',
	enabled: never
};
const lightning: IntermediaryNetwork = {
	value: 'lightning',
	label: 'Lightning',
	icon: '/btc/lightning.svg',
	enabled: always,
	feeCalculation: async (input: UnkCoinAmount, outputCoin: Coin) => {
		const meta = await getV4VMetadata();
		return (await input.convertTo(Coin.sats, Network.lightning))
			.mul(
				// meta.config.conv_fee_percent +
				meta.config.v4v_fees_streaming_sats_to_hive_percent
			)
			.add(new CoinAmount(meta.config.conv_fee_sats, Coin.sats))
			.convertTo(outputCoin, Network.lightning);
	}
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
			}
			// {
			// 	coin: btc,
			// 	networks: [lightning, btcMainnet]
			// }
		]
	}
};

export default swapOptions;

globalThis.coins = Coin;
