import { getV4VMetadata } from '../v4v/api-types/metadata';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
import type { ImageIconOption } from '$lib/components/ImageIconRenderer.svelte';
import { EVM_BRIDGE_ENABLED } from '$lib/constants';
import { isVscTestnet } from '../../../client';

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
// ETH and USDC as the EVM bridge maps them on Magi (wei and USDC's 6 places,
// the contracts' own units, so every existing quote/payload path works as is).
// A JS number is exact only to 2^53: read chain balances and write payload
// amounts through $lib/currency/chainAmount, which keeps both exact.
const eth: Coin = {
	value: 'eth',
	label: 'ETH',
	icon: '/eth/eth.svg',
	unit: 'ETH',
	ucid: '1027',
	decimalPlaces: 18
};
const usdc: Coin = {
	value: 'usdc',
	label: 'USDC',
	icon: '/usdc/usdc.svg',
	unit: 'USDC',
	ucid: '3408',
	decimalPlaces: 6
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
	eth,
	usdc,
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
const ethMainnet: Network = {
	value: 'eth_mainnet',
	// Chain 1 as wallets name it (MetaMask, chainlist.org), like 'BTC Mainnet':
	// the same 0x address on BSC, Base or Arbitrum is not this network.
	label: isVscTestnet() ? 'Ethereum (Sepolia)' : 'Ethereum Mainnet',
	icon: '/eth/eth.svg',
	// Read by the review screen's settlement label, i.e. a withdrawal to
	// Ethereum: mined 3 min after the request on testnet 2026-11-19. (A deposit
	// waits for finality and the header proof, ~30 min; its page says so.)
	settlementSeconds: 300
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
	ethMainnet,
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
	[
		Network.magi.value,
		[
			Coin.hive,
			Coin.hbd,
			Coin.shbd,
			Coin.btc,
			...(EVM_BRIDGE_ENABLED ? [Coin.eth, Coin.usdc] : []),
			Coin.sats
		]
	],
	[Network.hiveMainnet.value, [Coin.hive, Coin.hbd]],
	[Network.lightning.value, [Coin.btc]],
	...(EVM_BRIDGE_ENABLED
		? ([[Network.ethMainnet.value, [Coin.eth, Coin.usdc]]] as [string, Coin[]][])
		: [])
]);

const swapOptions: {
	from: CoinOptions;
	to: CoinOptions;
} = {
	from: [
		{ coin: hive, networks: [magi, hiveMainnet] },
		{ coin: hbd, networks: [magi, hiveMainnet] },
		{ coin: shbd, networks: [magi] },
		{ coin: btc, networks: [magi, btcMainnet] },
		// ETH/USDC move in and out of Magi through the deposit and withdraw pages;
		// the swap card trades the Magi balances.
		...(EVM_BRIDGE_ENABLED
			? [
					{ coin: eth, networks: [magi] },
					{ coin: usdc, networks: [magi] }
				]
			: [])
	],
	to: [
		{ coin: hive, networks: [magi, hiveMainnet] },
		{ coin: hbd, networks: [magi, hiveMainnet] },
		{ coin: btc, networks: [btcMainnet, magi] },
		...(EVM_BRIDGE_ENABLED
			? [
					{ coin: eth, networks: [magi] },
					{ coin: usdc, networks: [magi] }
				]
			: [])
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

/**
 * Can `coinValue` be the SOURCE of a swap on `networkValue`?
 *
 * The swap card's flip handed the incoming coin whatever network the outgoing
 * one had been on, which produces pairs like "HIVE on the Bitcoin network" —
 * a coin on a network it cannot exist on. Nothing downstream rejected it:
 * `send()` fails to classify such a pair as a swap and falls through to the
 * plain-transfer builder, so pressing "Review swap" signed a BTC TRANSFER
 * instead of a swap — to a leftover recipient if one was still in state (H1).
 *
 * Lightning is excluded on purpose: the source step never offers it, so a
 * source sitting on it is the same kind of impossible state.
 *
 * A coin with no entry in `swapOptions.from` (a custom token, SATS) exists on
 * Magi only, so Magi is the one legal answer for it.
 *
 * Being listed in `swapOptions.from` is necessary but NOT sufficient: that
 * table is shared with the deposit, withdraw and transfer flows, which do
 * legitimately source BTC from Bitcoin L1. `send()` classifies a swap source
 * only as Magi, or Hive L1 for native HIVE/HBD (where it prepends the
 * deposit op) — so "BTC on Bitcoin -> HIVE" passed every swap branch and was
 * built by the generic sender as a plain HIVE transfer. The source dialog
 * offered that pair, so this was reachable without any flip.
 */
export function isSelectableSource(
	coinValue: string | undefined,
	networkValue: string | undefined
): boolean {
	if (!coinValue || !networkValue) return false;
	if (networkValue === Network.lightning.value) return false;
	const opt = getFromOption(coinValue);
	if (!opt) return networkValue === Network.magi.value;
	if (!opt.networks.some((n) => n.value === networkValue)) return false;
	// Magi is always sourceable: the router pulls from the Magi ledger.
	if (networkValue === Network.magi.value) return true;
	// Hive L1 only for native HIVE/HBD, which `send()` funds by prepending a
	// deposit op. Every other mainnet — Bitcoin above all — has no such path.
	return (
		networkValue === Network.hiveMainnet.value &&
		(coinValue === hive.value || coinValue === hbd.value)
	);
}

/**
 * The network a coin should be sourced from: `preferred` when the coin can
 * actually be there, otherwise the coin's own first selectable network.
 *
 * Used wherever a source pair is built from parts that may not belong
 * together — the flip, and the pair restored from localStorage.
 */
export function resolveSourceNetwork(
	coinValue: string | undefined,
	preferredValue: string | undefined
): Network {
	if (isSelectableSource(coinValue, preferredValue)) {
		const preferred = Object.values(Network).find((n) => n.value === preferredValue);
		if (preferred) return preferred;
	}
	const opt = getFromOption(coinValue);
	const first = opt?.networks.find((n) => n.value !== Network.lightning.value);
	return first ?? Network.magi;
}

/**
 * The mainnet network a coin SETTLES to: Bitcoin for BTC, Hive L1 for HIVE
 * and HBD. A coin that exists only on Magi — a custom token, sHBD — has no
 * mainnet form, and gets Magi back.
 *
 * Read from the same `swapOptions.to` table the destination picker uses, so a
 * new asset is handled by listing it there and nowhere else.
 */
export function mainnetSwapDest(coinValue: string | undefined): Network {
	const opt = getToOption(coinValue);
	const external = opt?.networks.find(
		(n) => n.value !== Network.magi.value && n.value !== Network.lightning.value
	);
	return external ?? Network.magi;
}

/**
 * The mainnet network a coin can be PAID FROM in a swap — which is not the
 * mirror of `mainnetSwapDest`: BTC settles to Bitcoin but cannot be sourced
 * there (see `isSelectableSource`), so BTC starts on Magi.
 *
 * The swap card opens mainnet-to-mainnet (M9), and this keeps that default
 * from being a pair the gate would then refuse to sign.
 */
export function mainnetSwapSource(coinValue: string | undefined): Network {
	const opt = getFromOption(coinValue);
	const external = opt?.networks.find(
		(n) => n.value !== Network.magi.value && isSelectableSource(coinValue, n.value)
	);
	return external ?? Network.magi;
}

/**
 * The built-in coins the DEX swaps: HIVE, HBD and BTC, and ETH/USDC once the EVM
 * bridge is live. A pair outside these (and the custom tokens) is a send, so a
 * coin missing here turns its swap into a transfer of the output coin.
 */
export function nativeSwapCoins(): string[] {
	return [
		Coin.hive.value,
		Coin.hbd.value,
		Coin.btc.value,
		...(EVM_BRIDGE_ENABLED ? [Coin.eth.value, Coin.usdc.value] : [])
	];
}
