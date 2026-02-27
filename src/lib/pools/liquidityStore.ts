import { writable } from 'svelte/store';
import type { PoolRow } from '$lib/pools/poolsData';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';

export type LiquidityDraft = {
	selectedPool: PoolRow | null;
	amount0Ca: CoinAmount<typeof Coin.hive | typeof Coin.hbd>;
	amount1Ca: CoinAmount<typeof Coin.hive | typeof Coin.hbd>;
	coin0: typeof Coin.hive | typeof Coin.hbd;
	coin1: typeof Coin.hive | typeof Coin.hbd;
	hasError: boolean;
	notInParity: boolean;
	exceed0: boolean;
	exceed1: boolean;
};

export const liquidityDraftStore = writable<LiquidityDraft>({
	selectedPool: null,
	amount0Ca: new CoinAmount(0, Coin.hive),
	amount1Ca: new CoinAmount(0, Coin.hbd),
	coin0: Coin.hive,
	coin1: Coin.hbd,
	hasError: false,
	notInParity: false,
	exceed0: false,
	exceed1: false
});

export function resetLiquidityDraft() {
	liquidityDraftStore.set({
		selectedPool: null,
		amount0Ca: new CoinAmount(0, Coin.hive),
		amount1Ca: new CoinAmount(0, Coin.hbd),
		coin0: Coin.hive,
		coin1: Coin.hbd,
		hasError: false,
		notInParity: false,
		exceed0: false,
		exceed1: false
	});
}

