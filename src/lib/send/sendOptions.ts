import type { Auth } from '../auth/store';
import { getV4VMetadata } from './v4v/api-types/metadata';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
const always: Enabled = () => true;
const never: Enabled = () => false;

const _nothingSelected: Enabled = (from, to) => {
	return from == undefined && to == undefined;
};

export type CoinOnNetwork = { coin: UnknownCoin; network: Network };
const _eitherNetworkEquals = (
	from: CoinOnNetwork | undefined,
	to: CoinOnNetwork | undefined,
	value: Network
) => {
	return from?.network == value || to?.network == value;
};

const _coinIsOneOf = (source: CoinOnNetwork | undefined, arr: UnknownCoin[]) => {
	return !(source?.coin && !arr.includes(source.coin));
};

const hive: Coin<'hive'> = {
	value: 'hive',
	label: 'HIVE',
	icon: '/hive/hive.svg',
	unit: 'HIVE',
	enabled: (going, info, auth, mode) => {
		// currently can't swap from hive to anything else
		if (going == 'from' && mode == 'swap') return false;
		if (info.from?.coin == Coin.btc) return true;
		if (info.from?.coin == undefined) return true;
		if (going == 'from') return true;
		if (info.from?.coin == Coin.hive) return true;
		return false;
	},
	decimalPlaces: 3
};
const hbd: Coin<'hbd'> = {
	value: 'hbd',
	label: 'HBD',
	icon: '/hive/hbd.svg',
	unit: 'HBD',
	enabled: (going, info, auth, mode) => {
		// currently can't swap from HBD to anything else
		if (going == 'from' && mode == 'swap') return false;

		if (info.from?.coin == Coin.btc) return true;
		if (info.from?.coin == undefined) return true;
		if (going == 'from') return true;
		if (info.from?.coin == Coin.hbd) return true;

		return false;
	},
	decimalPlaces: 3
};
const btc: Coin<'btc'> = {
	value: 'btc',
	label: 'BTC',
	icon: '/btc/btc.svg',
	unit: 'BTC',
	enabled: (going) => {
		return going == 'from';
	},
	decimalPlaces: 8
};

const usd: Coin<'usd'> = {
	value: 'usd',
	label: 'USD',
	icon: '/btc/btc.svg',
	unit: 'USD',
	enabled: never,
	decimalPlaces: 2
};

const sats: Coin<'sats'> = {
	value: 'sats',
	label: 'SATS',
	icon: '/btc/btc.svg',
	unit: 'SATS',
	enabled: (going) => {
		return going == 'from';
	},
	decimalPlaces: 0
};
const unk: Coin<'unk'> = {
	value: 'unk',
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

export type Coin<Value extends string> = {
	/**
	 * The value for a form submission
	 */
	value: Value;
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

export type UnknownCoin = Coin<string>;

type Enabled = (
	going: 'to' | 'from',
	info: {
		from?: Partial<CoinOnNetwork> | undefined;
		to?: Partial<CoinOnNetwork> | undefined;
	},
	auth: Auth,
	mode: 'send' | 'swap'
) => boolean;

const vsc: IntermediaryNetwork = {
	value: 'vsc',
	label: 'VSC',
	icon: '/vsc.png',
	enabled: (going, { from, to }) => {
		if (from?.coin == undefined || to?.coin == undefined) return true;
		if (from?.coin == to?.coin) return true;
		if (from?.coin == Coin.btc) return true;
		return false;
	},
	feeCalculation: async <FromCoinAmount extends UnkCoinAmount, ToCoin extends UnknownCoin>(
		input: FromCoinAmount,
		outputCoin: ToCoin
	) => {
		// 0 fees (uses HP but HP usage isn't displayed)
		return new CoinAmount(0, outputCoin);
	}
};
const unknown: IntermediaryNetwork = {
	value: 'unk',
	label: 'Unknown',
	icon: '/unk.svg',
	enabled: never,
	feeCalculation: async <FromCoinAmount extends UnkCoinAmount, ToCoin extends UnknownCoin>(
		from: FromCoinAmount,
		outputCoin: ToCoin
	) => {
		if (from.coin.value == outputCoin.value) {
			return new CoinAmount(0, outputCoin); // no fee if going between same currency type
		}
		throw new Error('cannot calculate fees for an unknown intermediary network.');
	}
};
const hiveMainnet: IntermediaryNetwork = {
	value: 'hive_mainnet',
	label: 'Hive Mainnet',
	icon: '/hive/hive.svg',
	enabled: (going, { from, to }, auth, mode) => {
		if (auth.value?.aioha == undefined && going == 'from') return false;
		if (auth.value?.aioha == undefined && mode == 'swap') return false;
		if (from?.coin == undefined || to?.coin == undefined) return true;
		if (from?.coin == to?.coin) return true;
		if (from?.coin == Coin.btc) return true;
		return false;
	},
	feeCalculation: async (from, outputCoin) => {
		return new CoinAmount(0, outputCoin);
	}
};

type FeeCalculation = <FromCoinAmount extends UnkCoinAmount, ToCoin extends UnknownCoin>(
	from: FromCoinAmount,
	outputCoin: ToCoin
) => Promise<CoinAmount<ToCoin>>;
export type Network = {
	value: string;
	label: string;
	icon: string;
	enabled: Enabled;
	feeCalculation?: FeeCalculation;
};

export type IntermediaryNetwork = Network & {
	feeCalculation: FeeCalculation;
};

const btcMainnet: Network = {
	value: 'btc_mainnet',
	label: 'BTC Mainnet',
	icon: '/btc/btc.svg',
	enabled: always
};
const lightning: IntermediaryNetwork = {
	value: 'lightning',
	label: 'Lightning',
	icon: '/btc/lightning.svg',
	enabled: always,
	feeCalculation: async <FromCoinAmount extends UnkCoinAmount, ToCoin extends UnknownCoin>(
		input: FromCoinAmount,
		outputCoin: ToCoin
	) => {
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

const boltzLightning: IntermediaryNetwork = {
	value: 'boltz',
	label: 'Boltz',
	icon: '/btc/boltz.svg',
	enabled: always,
	feeCalculation: async <FromCoinAmount extends UnkCoinAmount, ToCoin extends UnknownCoin>(
		input: FromCoinAmount,
		outputCoin: ToCoin
	) => {
		type Root = {
			BTC: {
				BTC: {
					hash: string;
					rate: number;
					limits: {
						maximal: number;
						minimal: number;
						maximalZeroConf: number;
					};
					fees: {
						percentage: number;
						minerFees: number;
					};
				};
			};
		};

		const {
			BTC: {
				BTC: { fees }
			}
		}: Root = await (await fetch('https://api.boltz.exchange/v2/swap/submarine')).json();
		const convertedInput = await input.convertTo(outputCoin, Network.lightning);
		const boltzFees = (
			await new CoinAmount(fees.minerFees, Coin.sats).convertTo(outputCoin, Network.lightning)
		).add(convertedInput.mul(fees.percentage));
		return boltzFees.add(
			await Network.lightning.feeCalculation(convertedInput.sub(boltzFees), outputCoin)
		);
	}
};

export const Network = {
	btcMainnet,
	lightning,
	hiveMainnet,
	vsc,
	unknown,
	boltzLightning
};

export type CoinOptions = {
	coins: {
		coin: UnknownCoin;
		networks: Network[];
		default?: UnknownCoin;
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
