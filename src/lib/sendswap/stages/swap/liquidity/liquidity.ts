import { Coin } from '$lib/sendswap/utils/sendOptions';

export type LiquidityPool = {
	value: string;
	label: string;
	coin1: Coin;
	coin2: Coin;
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
