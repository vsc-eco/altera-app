import { readable, readonly, writable, type Readable } from 'svelte/store';
import { Coin, type CoinOnNetwork, type Network } from './sendOptions';
import { getCryptoPrices as getLightningCryptoPrices } from './v4v/api-types/cryptoprices';

export function satsToBtc(sats: number): number {
	return sats * 0.00000001;
}

export function btcToSats(sats: number): number {
	return Math.round(sats * 100_000_000);
}
