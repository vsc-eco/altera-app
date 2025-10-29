// import type { Auth } from '../auth/store';
// import { getV4VMetadata } from './v4v/api-types/metadata';
// import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
// import { Record } from '$houdini/runtime/public/record';
// import { BadgeDollarSign, type Icon as LucideIcon } from '@lucide/svelte';
// import type { SvelteComponent } from 'svelte';
// const always: Enabled = () => true;
// const never: Enabled = () => false;

// const _nothingSelected: Enabled = (from, to) => {
// 	return from == undefined && to == undefined;
// };

// export type CoinOnNetwork = { coin: Coin; network: Network };
// const _eitherNetworkEquals = (
// 	from: CoinOnNetwork | undefined,
// 	to: CoinOnNetwork | undefined,
// 	value: Network
// ) => {
// 	return from?.network == value || to?.network == value;
// };

// const _coinIsOneOf = (source: CoinOnNetwork | undefined, arr: Coin[]) => {
// 	return !(source?.coin && !arr.includes(source.coin));
// };

// const hive: Coin = {
// 	value: 'hive',
// 	label: 'HIVE',
// 	icon: '/hive/hive.svg',
// 	unit: 'HIVE',
// 	ucid: '5370',
// 	enabled: (going, info, auth, mode) => {
// 		// currently can't swap from hive to anything else
// 		if (going == 'from' && mode == 'swap') return false;

// 		if (info.from?.network == Network.lightning) return true;
// 		if (info.from?.coin == undefined) return true;
// 		if (going == 'from') return true;
// 		if (info.from?.coin == Coin.hive) return true;
// 		return false;
// 	},
// 	decimalPlaces: 3
// };
// const hbd: Coin = {
// 	value: 'hbd',
// 	label: 'HBD',
// 	icon: '/hive/hbd.svg',
// 	unit: 'HBD',
// 	ucid: '5375',
// 	enabled: (going, info, auth, mode) => {
// 		// currently can't swap from HBD to anything else
// 		if (going == 'from' && mode == 'swap') return false;

// 		if (info.from?.network == Network.lightning) return true;
// 		if (info.from?.coin == undefined) return true;
// 		if (going == 'from') return true;
// 		if (info.from?.coin == Coin.hbd) return true;
// 		return false;
// 	},
// 	decimalPlaces: 3
// };
// const shbd: Coin = {
// 	value: 'hbd_savings',
// 	label: 'sHBD',
// 	icon: '/hive/hbd.svg',
// 	unit: 'HBD',
// 	ucid: '5375',
// 	enabled: () => false,
// 	decimalPlaces: 3
// };
// const btc: Coin = {
// 	value: 'btc',
// 	label: 'BTC',
// 	icon: '/btc/btc.svg',
// 	unit: 'BTC',
// 	ucid: '1',
// 	enabled: (going) => {
// 		return going == 'from';
// 	},
// 	decimalPlaces: 8
// };

// const usd: Coin = {
// 	value: 'usd',
// 	label: 'USD',
// 	icon: '/fiat/usd.svg',
// 	unit: 'USD',
// 	enabled: never,
// 	decimalPlaces: 2
// };

// const sats: Coin = {
// 	value: 'SATS',
// 	label: 'SATS',
// 	icon: '/btc/btc.svg',
// 	unit: 'SATS',
// 	enabled: (going) => {
// 		return going == 'from';
// 	},
// 	decimalPlaces: 0
// };
// const unk: Coin = {
// 	value: 'UNK',
// 	label: 'UNK',
// 	icon: '/unk.svg',
// 	unit: 'UNK',
// 	enabled: never,
// 	decimalPlaces: 8
// };

// export const Coin = {
// 	hive,
// 	hbd,
// 	shbd,
// 	btc,
// 	sats,
// 	usd,
// 	unk
// };

// export type Coin = {
// 	/**
// 	 * The value for a form submission
// 	 */
// 	value: string;
// 	/**
// 	 * The label to display in a form field (ex. radio group)
// 	 */
// 	label: string;
// 	/**
// 	 * A href for the icon of the coin
// 	 */
// 	icon: string;
// 	/**
// 	 * The text to display next to a currency (usually 3-4 letters for the currency)
// 	 */
// 	unit: string;
// 	/**
// 	 * The UCID of the token (unique ID to differentiate between coins with the same ticker)
// 	 */
// 	ucid?: string;
// 	/**
// 	 * A function which returns whether a currency is available to trade to/from
// 	 * based on the network and currency it's going to/from
// 	 */
// 	enabled: Enabled;
// 	/**
// 	 * Number of decimal places to use for arithmetic and display
// 	 */
// 	decimalPlaces: number;
// };

// type Enabled = (
// 	going: 'to' | 'from',
// 	info: {
// 		from?: Partial<CoinOnNetwork> | undefined;
// 		to?: Partial<CoinOnNetwork> | undefined;
// 	},
// 	auth: Auth,
// 	mode: 'send' | 'swap'
// ) => boolean;

// const vsc: IntermediaryNetwork = {
// 	value: 'vsc',
// 	label: 'VSC',
// 	icon: '/magi.svg',
// 	enabled: (going, { from, to }) => {
// 		if (from?.coin == undefined || to?.coin == undefined) return true;
// 		if (from?.coin == to?.coin) return true;
// 		if (from?.network == Network.lightning) return true;
// 		return false;
// 	},
// 	feeCalculation: async (input: UnkCoinAmount, outputCoin: Coin) => {
// 		// 0 fees (uses HP but HP usage isn't displayed)
// 		return new CoinAmount(0, outputCoin);
// 	}
// };
// const unknown: IntermediaryNetwork = {
// 	value: 'unk',
// 	label: 'Unknown',
// 	icon: '/unk.svg',
// 	enabled: never,
// 	feeCalculation: async (from: UnkCoinAmount, outputCoin: Coin) => {
// 		if (from.coin.value == outputCoin.value) {
// 			return new CoinAmount(0, from.coin); // no fee if going between same currency type
// 		}
// 		throw new Error('cannot calculate fees for an unknown intermediary network.');
// 	}
// };
// const hiveMainnet: IntermediaryNetwork = {
// 	value: 'hive_mainnet',
// 	label: 'Hive Mainnet',
// 	icon: '/hive/hive.svg',
// 	enabled: (going, { from, to }, auth, mode) => {
// 		if (auth.value?.aioha == undefined && going == 'from') return false;
// 		if (auth.value?.aioha == undefined && mode == 'swap') return false;
// 		if (from?.coin == undefined || to?.coin == undefined) return true;
// 		if (from?.coin == to?.coin) return true;
// 		if (from?.network == Network.lightning) return true;
// 		return false;
// 	},
// 	feeCalculation: async (from, outputCoin) => {
// 		return new CoinAmount(0, outputCoin);
// 	}
// };

// type FeeCalculation<FromCoinAmount extends UnkCoinAmount, ToCoin extends Coin> = (
// 	from: FromCoinAmount,
// 	outputCoin: ToCoin
// ) => Promise<CoinAmount<ToCoin>>;
// export type Network = {
// 	value: string;
// 	label: string;
// 	icon: string;
// 	enabled: Enabled;
// 	feeCalculation?: FeeCalculation<UnkCoinAmount, Coin>;
// };

// export type IntermediaryNetwork = Network & { feeCalculation: FeeCalculation<UnkCoinAmount, Coin> };

// const btcMainnet: Network = {
// 	value: 'btc_mainnet',
// 	label: 'BTC Mainnet',
// 	icon: '/btc/btc.svg',
// 	enabled: never
// };
// const lightning: IntermediaryNetwork = {
// 	value: 'lightning',
// 	label: 'Lightning',
// 	icon: '/btc/lightning.svg',
// 	enabled: always,
// 	feeCalculation: async (input: UnkCoinAmount, outputCoin: Coin) => {
// 		const meta = await getV4VMetadata();
// 		return (await input.convertTo(Coin.sats, Network.lightning))
// 			.mul(
// 				// meta.config.conv_fee_percent +
// 				meta.config.v4v_fees_streaming_sats_to_hive_percent
// 			)
// 			.add(new CoinAmount(meta.config.conv_fee_sats, Coin.sats))
// 			.convertTo(outputCoin, Network.lightning);
// 	}
// };

// export const Network = {
// 	btcMainnet,
// 	lightning,
// 	hiveMainnet,
// 	vsc,
// 	unknown
// };

// export type CoinOptions = {
// 	coins: {
// 		coin: Coin;
// 		networks: Network[];
// 		default?: Coin;
// 	}[];
// };

// export type SendDetails = {
// 	fromCoin: CoinOptions['coins'][number] | undefined;
// 	fromNetwork: Network | undefined;
// 	fromAmount: string;
// 	toCoin: CoinOptions['coins'][number] | undefined;
// 	toNetwork: Network | undefined;
// 	toAmount: string;
// 	toUsername: string;
// 	fee: CoinAmount<Coin> | undefined;
// 	method: TransferMethod | undefined;
// 	account: SendAccount | undefined;
// 	toDisplayName: string;
// 	memo: string;
// };

// export type NecessarySendDetails = {
// 	fromCoin: CoinOptions['coins'][number];
// 	fromNetwork: Network;
// 	amount: string;
// 	toCoin: CoinOptions['coins'][number];
// 	toNetwork: Network;
// 	toUsername: string;
// 	memo?: string;
// };

// export type TransferMethod = {
// 	label: string;
// 	value: string;
// 	length: string;
// 	fees: string;
// };

// const vscTransfer: TransferMethod = {
// 	label: 'VSC Transfer',
// 	value: 'vsc-transfer',
// 	length: 'Instant',
// 	fees: 'No Fees'
// };

// const lightningTransfer: TransferMethod = {
// 	label: 'Lightning Network',
// 	value: 'lightning',
// 	length: 'About a Minute',
// 	fees: '2% Fee'
// };

// export const TransferMethod = {
// 	vscTransfer,
// 	lightningTransfer
// };

// export const networkMap: Map<string, Coin[]> = new Map([
// 	[Network.vsc.value, [Coin.hive, Coin.hbd, Coin.shbd]],
// 	[Network.hiveMainnet.value, [Coin.hive, Coin.hbd]],
// 	[Network.lightning.value, [Coin.btc]]
// ]);

// export type SendAccount = {
// 	value: string;
// 	label: string;
// 	icon?: string;
// 	fee?: string;
// };

// const vscAccount: SendAccount = {
// 	label: 'VSC Account',
// 	value: 'vsc-account',
// 	icon: '/magi.svg'
// };

// const deposit: SendAccount = {
// 	label: 'Deposit',
// 	value: 'deposit',
// 	fee: '0-3%'
// };

// const swap: SendAccount = {
// 	label: 'Swap',
// 	value: 'swap',
// 	fee: '0-3%'
// };

// export const SendAccount = {
// 	vscAccount,
// 	deposit,
// 	swap
// };

// const swapOptions: {
// 	from: CoinOptions;
// 	to: CoinOptions;
// } = {
// 	from: {
// 		coins: [
// 			{
// 				coin: hive,
// 				networks: [vsc, hiveMainnet]
// 			},
// 			{
// 				coin: hbd,
// 				networks: [vsc, hiveMainnet]
// 			},
// 			{
// 				coin: shbd,
// 				networks: [vsc]
// 			},
// 			{
// 				coin: btc,
// 				// networks: [lightning, btcMainnet]
// 				networks: [lightning]
// 			}
// 		]
// 	},
// 	to: {
// 		coins: [
// 			{
// 				coin: hive,
// 				networks: [vsc, hiveMainnet]
// 			},
// 			{
// 				coin: hbd,
// 				networks: [vsc, hiveMainnet]
// 			}
// 			// {
// 			// 	coin: btc,
// 			// 	networks: [lightning, btcMainnet]
// 			// }
// 		]
// 	}
// };

// export default swapOptions;

// globalThis.coins = Coin;
