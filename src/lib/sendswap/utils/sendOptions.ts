import { getV4VMetadata } from '../v4v/api-types/metadata';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
import type { ImageIconOption } from '$lib/components/ImageIconRenderer.svelte';

export type CoinOnNetwork = { coin: Coin; network: Network };

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
	settlementSeconds: 0, // instant
	feeCalculation: async (input: UnkCoinAmount, outputCoin: Coin) => {
		// 0 fees (uses HP but HP usage isn't displayed)
		return new CoinAmount(0, outputCoin);
	}
};
const unknown: IntermediaryNetwork = {
	value: 'unk',
	label: 'Unknown',
	icon: '/unk.svg',
	settlementSeconds: 0,
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
	settlementSeconds: 3, // ~Hive block; effectively instant for display
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
	/**
	 * Typical settlement time for a TX touching this network, in seconds. Used
	 * by `settlementLabel(networks[])` to pick the longest among the networks
	 * involved in a TX and format the human-readable ETA shown in ReviewSwap.
	 * 0 = effectively instant.
	 */
	settlementSeconds: number;
};

export type IntermediaryNetwork = Network & { feeCalculation: FeeCalculation<UnkCoinAmount, Coin> };

const btcMainnet: Network = {
	value: 'btc_mainnet',
	label: 'BTC Mainnet',
	icon: '/btc/btc.svg',
	settlementSeconds: 600 // ~10 min on L1
};
const lightning: IntermediaryNetwork = {
	value: 'lightning',
	label: 'Lightning',
	icon: '/btc/lightning.svg',
	settlementSeconds: 60, // ~1 min via the v4v gateway
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

/** A selectable asset: a coin plus the networks it can move over. */
export type AssetOption = {
	coin: Coin;
	networks: Network[];
};

/** Ordered list of selectable assets (was `{ coins: AssetOption[] }`). */
export type CoinOptions = AssetOption[];

export const networkMap: Map<string, Coin[]> = new Map([
	[Network.magi.value, [Coin.hive, Coin.hbd, Coin.shbd, Coin.btc, Coin.sats]],
	[Network.hiveMainnet.value, [Coin.hive, Coin.hbd]],
	[Network.lightning.value, [Coin.btc]]
]);

const swapOptions: {
	from: CoinOptions;
	to: CoinOptions;
} = {
	from: [
		{ coin: hive, networks: [magi, hiveMainnet] },
		{ coin: hbd, networks: [magi, hiveMainnet] },
		{ coin: shbd, networks: [magi] },
		{ coin: btc, networks: [magi, btcMainnet] }
	],
	to: [
		{ coin: hive, networks: [magi, hiveMainnet] },
		{ coin: hbd, networks: [magi, hiveMainnet] },
		{ coin: btc, networks: [btcMainnet, magi] }
	]
};

export default swapOptions;

/**
 * Look up the `from` / `to` asset option by coin value. Replaces the ~20
 * hand-written `swapOptions.from.coins.find((c) => c.coin.value === v)` calls
 * scattered across the send/swap stages.
 */
export const getFromOption = (coinValue: string | undefined): AssetOption | undefined =>
	swapOptions.from.find((o) => o.coin.value === coinValue);
export const getToOption = (coinValue: string | undefined): AssetOption | undefined =>
	swapOptions.to.find((o) => o.coin.value === coinValue);

// APP-17: only expose internals on globalThis in development builds.
if (import.meta.env.DEV) {
	globalThis.coins = Coin;
}
