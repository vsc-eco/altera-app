import type { ImageIconOption } from '$lib/components/ImageIconRenderer.svelte'
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount'
import { getV4VMetadata } from '../v4v/api-types/metadata'
const always: Enabled = () => true
const never: Enabled = () => false

export type CoinOnNetwork = { coin: Coin; network: Network }

const hive: Coin = {
	value: 'hive',
	label: 'HIVE',
	icon: '/hive/hive.svg',
	unit: 'HIVE',
	ucid: '5370',
	decimalPlaces: 3
};
const hbd: Coin = {
	value: 'hbd',
	label: 'HBD',
	icon: '/hive/hbd.svg',
	unit: 'HBD',
	ucid: '5375',
	decimalPlaces: 3
};
const shbd: Coin = {
	value: 'hbd_savings',
	label: 'sHBD',
	icon: '/hive/hbd.svg',
	unit: 'sHBD',
	ucid: '5375',
	decimalPlaces: 3
};
const btc: Coin = {
	value: 'btc',
	label: 'BTC',
	icon: '/btc/btc.svg',
	unit: 'BTC',
	ucid: '1',
	decimalPlaces: 8
};

const usd: Coin = {
	value: 'usd',
	label: 'USD',
	icon: '/fiat/usd.svg',
	unit: 'USD',
	decimalPlaces: 2
};

const sats: Coin = {
	value: 'sats',
	label: 'SATS',
	icon: '/btc/btc.svg',
	unit: 'SATS',
	decimalPlaces: 0
};
const unk: Coin = {
	value: 'UNK',
	label: 'UNK',
	icon: '/unk.svg',
	unit: 'UNK',
	decimalPlaces: 8
};

export const Coin = {
	hive,
	hbd,
	shbd,
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
	 * The UCID of the token (unique ID to differentiate between coins with the same ticker)
	 */
	ucid?: string;
	/**
	 * Number of decimal places to use for arithmetic and display
	 */
	decimalPlaces: number;
};

const magi: IntermediaryNetwork = {
	value: 'magi',
	label: 'Magi',
	icon: '/magi.svg',
	feeCalculation: async (input: UnkCoinAmount, outputCoin: Coin) => {
		// 0 fees (uses HP but HP usage isn't displayed)
		return new CoinAmount(0, outputCoin);
	}
};
const unknown: IntermediaryNetwork = {
	value: 'unk',
	label: 'Unknown',
	icon: '/unk.svg',
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
	icon: ImageIconOption;
	feeCalculation?: FeeCalculation<UnkCoinAmount, Coin>;
};

export type IntermediaryNetwork = Network & { feeCalculation: FeeCalculation<UnkCoinAmount, Coin> };

const btcMainnet: Network = {
	value: 'btc_mainnet',
	label: 'BTC Mainnet',
	icon: '/btc/btc.svg'
};
const lightning: IntermediaryNetwork = {
	value: 'lightning',
	label: 'Lightning',
	icon: '/btc/lightning.svg',
	feeCalculation: async (input: UnkCoinAmount, outputCoin: Coin) => {
		const meta = await getV4VMetadata();
		const amt = await input.convertTo(Coin.sats, Network.lightning);
		const feeInSats = amt
			.mul(meta.config.conv_fee_percent)
			.add(new CoinAmount(meta.config.conv_fee_sats, Coin.sats));
		if (outputCoin.value === Coin.sats.value) {
			return feeInSats;
		}
		return feeInSats.convertTo(outputCoin, Network.lightning);
	}
};

export const Network = {
	btcMainnet,
	lightning,
	hiveMainnet,
	magi,
	unknown
};

export type CoinOptions = {
	coins: {
		coin: Coin;
		networks: Network[];
		default?: Coin;
	}[];
};

export type TransferMethod = {
	label: string;
	value: string;
	length: string;
	fees: string;
};

const magiTransfer: TransferMethod = {
	label: 'Magi Transfer',
	value: 'magi-transfer',
	length: 'Instant',
	fees: 'No Fees'
};

const lightningTransfer: TransferMethod = {
	label: 'Lightning Network',
	value: 'lightning',
	length: 'About a Minute',
	fees: '2% Fee'
};

export const TransferMethod = {
	magiTransfer,
	lightningTransfer
};

export const networkMap: Map<string, Coin[]> = new Map([
	[Network.magi.value, [Coin.hive, Coin.hbd, Coin.shbd, Coin.btc, Coin.sats]],
	[Network.hiveMainnet.value, [Coin.hive, Coin.hbd]],
	[Network.lightning.value, [Coin.btc]]
]);

export type SendAccount = {
	value: string;
	label: string;
	icon?: string;
	fee?: string;
};

const magiAccount: SendAccount = {
	label: 'Magi Account',
	value: 'magi-account',
	icon: '/magi.svg'
};

const deposit: SendAccount = {
	label: 'Deposit',
	value: 'deposit',
	fee: '0-3%'
};

const swap: SendAccount = {
	label: 'Swap',
	value: 'swap',
	fee: '0-3%'
};

export const SendAccount = {
	magiAccount,
	deposit,
	swap
};

const swapOptions: {
	from: CoinOptions;
	to: CoinOptions;
} = {
	from: {
		coins: [
			{
				coin: hive,
				networks: [magi, hiveMainnet]
			},
			{
				coin: hbd,
				networks: [magi, hiveMainnet]
			},
			{
				coin: shbd,
				networks: [magi]
			},
			{
				coin: btc,
				// networks: [lightning, btcMainnet]
				// networks: [lightning, magi, btcMainnet]
				networks: [magi, btcMainnet]
			}
		]
	},
	to: {
		coins: [
			{
				coin: hive,
				networks: [magi, hiveMainnet]
			},
			{
				coin: hbd,
				networks: [magi, hiveMainnet]
			},
			{
				coin: btc,
				// networks: [lightning, btcMainnet, magi]
				networks: [btcMainnet, magi]
			}
		]
	}
};

export default swapOptions;

globalThis.coins = Coin;
