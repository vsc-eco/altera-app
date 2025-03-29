import { readable, readonly, writable, type Readable } from 'svelte/store';
import { Coin, type CoinOnNetwork, type Network } from './sendOptions';
import { getCryptoPrices as getLightningCryptoPrices } from './v4v/api-types/cryptoprices';

// btc.on.lightning.into.usd.on.vsc.getMultiplier()
export type Unit = {
	coin: Coin;
	on: {
		[fromNetwork: string]: {
			network: Network;
			into: {
				[toCoin: string]: Unit;
			};
		};
	};
};
let btc: Unit = { coin: Coin.btc, on: {} };

type FeeCalculator<From extends CoinOnNetwork, To extends CoinOnNetwork> = {
	getMultiplier(from: From, to: To): Promise<Readable<number>>;
	getFee(from: From, to: To, amount: number): Promise<Readable<number>>;
};

export function satsToBtc(sats: number): number {
	return sats * 0.00000001;
}

export function btcToSats(sats: number): number {
	return sats * 100_000_000;
}
export function getLightningFeeCalculator(): FeeCalculator<
	{
		coin: Coin;
		network: typeof Network.lightning;
	},
	{
		coin: Coin;
		network: typeof Network.hiveMainnet | typeof Network.vsc;
	}
> {
	return {
		async getFee({ coin: fromCoin }, to, amount) {
			let initialPrices = await getLightningCryptoPrices();
			fromCoin.label;
			let fee = readable(0, (set) => {
				let { signal, abort } = new AbortController();
			});
			return fee;
		},
		async getMultiplier(from, to) {
			let multiplierWritable = writable(0, (set, update) => {});

			return readonly(writable(0));
		}
	};
}

type UnitConversionMap = {
	[toLabel: string]: {
		on: {
			[networkLabel: string]: {};
		};
	};
};
