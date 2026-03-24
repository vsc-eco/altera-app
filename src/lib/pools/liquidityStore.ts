import { writable } from 'svelte/store';
import type { PoolRow } from '$lib/pools/poolsData';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';

export type LiquidityDraft = {
	selectedPool: PoolRow | null;
	amount0Ca: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>;
	amount1Ca: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>;
	coin0: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;
	coin1: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;
	hasError: boolean;
	notInParity: boolean;
	exceed0: boolean;
	exceed1: boolean;
};

export const liquidityDraftStore = writable<LiquidityDraft>({
	selectedPool: null,
	amount0Ca: new CoinAmount(0, Coin.hbd),
	amount1Ca: new CoinAmount(0, Coin.btc),
	coin0: Coin.hbd,
	coin1: Coin.btc,
	hasError: false,
	notInParity: false,
	exceed0: false,
	exceed1: false
});

export function resetLiquidityDraft() {
	liquidityDraftStore.set({
		selectedPool: null,
		amount0Ca: new CoinAmount(0, Coin.hbd),
		amount1Ca: new CoinAmount(0, Coin.btc),
		coin0: Coin.hbd,
		coin1: Coin.btc,
		hasError: false,
		notInParity: false,
		exceed0: false,
		exceed1: false
	});
}

