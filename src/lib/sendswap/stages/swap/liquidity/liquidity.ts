import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { writable } from 'svelte/store';

export type LiquidityPool<C1 extends Coin = Coin, C2 extends Coin = Coin> = {
	value: string;
	label: string;
	coin1: C1;
	coin2: C2;
};

const btcHbd: LiquidityPool = {
	value: 'btchbd',
	label: 'BTC to HBD',
	coin1: Coin.btc,
	coin2: Coin.hbd
};

const hiveHbd: LiquidityPool = {
	value: 'hivehbd',
	label: 'HIVE to HBD',
	coin1: Coin.hive,
	coin2: Coin.hbd
};

export const LiquidityPool = {
	btcHbd,
	hiveHbd
};

export type LiquidityDetails<C1 extends Coin = Coin, C2 extends Coin = Coin> = {
	pool: LiquidityPool<C1, C2> | undefined;
	amount1: CoinAmount<C1>;
	amount2: CoinAmount<C2>;
};

export function blankLiquidityDetails(): LiquidityDetails {
	return {
		pool: undefined,
		amount1: new CoinAmount(0, Coin.unk),
		amount2: new CoinAmount(0, Coin.unk)
	};
}

export const LiquidityTxDetails = writable<LiquidityDetails>(blankLiquidityDetails());
