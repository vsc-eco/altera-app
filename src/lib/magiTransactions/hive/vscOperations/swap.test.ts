import { describe, expect, it, vi } from 'vitest';

// swap.ts pulls in the price API for the (inactive) Altera fee; the op shape
// under test never calls it.
vi.mock('$lib/sendswap/v4v/api-types/cryptoprices', () => ({ getCryptoPrices: vi.fn() }));
// The account's RC, as the node reports it (fetchAccountRc).
const accountRc = vi.hoisted(() => ({ value: undefined as number | undefined }));
vi.mock('./rcSizing', () => ({ fetchAccountRc: vi.fn(async () => accountRc.value) }));

import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { getHiveSwapOp, hivePaidSwapRcShortfall, hiveSwapRcLimit } from './swap';

async function rcLimitOf(destinationChain?: string, payoutRcLimit?: number) {
	const swapOp = await getHiveSwapOp(
		'audiohive-me',
		new CoinAmount('25', Coin.hive),
		Coin.hive,
		Coin.btc,
		1454,
		destinationChain,
		destinationChain === 'BTC' ? 'bc1qk90rvuqpmewgplaxt2x9s46pce6rh0vdjcpw20csf77x99rcqn9qnjdj97' : undefined,
		payoutRcLimit
	);
	return JSON.parse(swapOp[1].json).rc_limit;
}

describe('getHiveSwapOp rc_limit', () => {
	it('uses the sized limit for a BTC payout', async () => {
		expect(await rcLimitOf('BTC', 13_000)).toBe(13_000);
	});

	it('keeps 10,000 for a BTC payout nobody sized (old callers)', async () => {
		expect(await rcLimitOf('BTC')).toBe(10_000);
	});

	it('uses the sized limit for an Ethereum payout (destination_chain ETH)', async () => {
		expect(await rcLimitOf('ETH', 21_812)).toBe(21_812);
	});

	it('ignores a payout limit for a HIVE destination', async () => {
		expect(await rcLimitOf('HIVE', 50_000)).toBe(10_000);
	});

	// 11-21: by route (one hop 1,400, two 2,400; 1.5x the measured cost). An
	// HBD input is one hop and the node keeps rc_limit/1000 HBD back from it, so
	// 1,400 (below the old 2,000) leaves more of the balance swappable.
	it('gives a two-hop swap that stays on Magi 2,400 (HIVE->BTC goes through HBD)', async () => {
		expect(await rcLimitOf(undefined, 50_000)).toBe(2_400);
	});

	it('gives a one-hop swap that stays on Magi 1,400, so an HBD input keeps less HBD back', async () => {
		const op = await getHiveSwapOp('audiohive-me', new CoinAmount('20', Coin.hbd), Coin.hbd, Coin.btc, 1454);
		expect(JSON.parse(op[1].json).rc_limit).toBe(1_400);
	});
});

// A swap paid from the Hive wallet (its HIVE/HBD deposited in the same
// transaction) names the account on Hive as its return address: a swap that
// fails goes back there, never staying in the Magi balance.
describe('getHiveSwapOp return_address', () => {
	async function payloadOf(assetIn: typeof Coin.hive | typeof Coin.btc, returnToHive?: boolean) {
		const op = await getHiveSwapOp(
			'audiohive-me',
			new CoinAmount('25', assetIn),
			assetIn,
			Coin.usdc,
			3_000_000,
			'ETH',
			'0x00000000000000000000000000000000000000e2',
			21_812,
			returnToHive
		);
		return JSON.parse(JSON.parse(op[1].json).payload);
	}

	it('names the Hive account for a swap paid from the Hive wallet', async () => {
		expect((await payloadOf(Coin.hive, true)).return_address).toEqual({
			chain: 'HIVE',
			address: 'hive:audiohive-me'
		});
	});

	it('names none for a swap paid from the Magi balance', async () => {
		expect((await payloadOf(Coin.hive, false)).return_address).toBeUndefined();
		expect((await payloadOf(Coin.hive)).return_address).toBeUndefined();
	});

	it('names none for an input that is not HIVE or HBD (the router refuses it)', async () => {
		expect((await payloadOf(Coin.btc, true)).return_address).toBeUndefined();
	});
});

describe('getHiveSwapOp rc_limit with return_address on HIVE', () => {
	async function rcOf(destinationChain?: string, payoutRcLimit?: number) {
		const op = await getHiveSwapOp(
			'audiohive-me',
			new CoinAmount('25', Coin.hive),
			Coin.hive,
			Coin.hbd,
			1454,
			destinationChain,
			destinationChain === 'HIVE' ? 'hive:audiohive-me' : undefined,
			payoutRcLimit,
			true
		);
		return JSON.parse(op[1].json).rc_limit;
	}
	it('adds the self-call headroom to a fixed route limit', async () => {
		expect(await rcOf()).toBe(1_400 + 600);
		expect(await rcOf('HIVE')).toBe(10_000 + 600);
	});
	it('leaves a payout sized from the account alone', async () => {
		expect(await rcOf('ETH', 21_812)).toBe(21_812);
	});
});

describe('hiveSwapRcLimit for a swap paid from the Hive wallet', () => {
	it('adds the self-call headroom to a HIVE input', () => {
		expect(hiveSwapRcLimit(Coin.hive, Coin.hbd, undefined, undefined, true)).toBe(1_400 + 600);
		expect(hiveSwapRcLimit(Coin.hive, Coin.btc, undefined, undefined, true)).toBe(2_400 + 600);
	});
	it('adds none to an HBD input (the node holds rc_limit back from an HBD draw)', () => {
		expect(hiveSwapRcLimit(Coin.hbd, Coin.hive, undefined, undefined, true)).toBe(1_400);
		expect(hiveSwapRcLimit(Coin.hbd, Coin.hive, 'HIVE', undefined, true)).toBe(10_000);
	});
	it('keeps a sized payout limit', () => {
		expect(hiveSwapRcLimit(Coin.hive, Coin.usdc, 'ETH', 21_812, true)).toBe(21_812);
	});
});

describe('hivePaidSwapRcShortfall', () => {
	it('refuses an HBD swap paid out on Hive when the RC is below its 10,000 limit (the draw would fail)', async () => {
		accountRc.value = 9_999;
		expect(await hivePaidSwapRcShortfall('hive:a', Coin.hbd, Coin.hive, 'HIVE')).toEqual({
			needed: 10_000,
			available: 9_999
		});
	});
	it('lets a HIVE swap paid out on Hive go on the route cost, not the 10,000 limit', async () => {
		accountRc.value = 2_000;
		expect(await hivePaidSwapRcShortfall('hive:a', Coin.hive, Coin.hbd, 'HIVE')).toBeNull();
		accountRc.value = 1_999;
		expect(await hivePaidSwapRcShortfall('hive:a', Coin.hive, Coin.hbd, 'HIVE')).toEqual({
			needed: 2_000,
			available: 1_999
		});
	});
	it('goes on as before when the node cannot say', async () => {
		accountRc.value = undefined;
		expect(await hivePaidSwapRcShortfall('hive:a', Coin.hbd, Coin.hive)).toBeNull();
	});
	it('leaves payouts on Bitcoin and Ethereum to their own sizing', async () => {
		accountRc.value = 0;
		expect(await hivePaidSwapRcShortfall('hive:a', Coin.hive, Coin.usdc, 'ETH')).toBeNull();
	});
});

describe('getHiveSwapOp payout_gas_limit', () => {
	async function payloadOf(out: typeof Coin.eth | typeof Coin.usdc, limit: number | null) {
		const op = await getHiveSwapOp(
			'audiohive-me',
			new CoinAmount('25', Coin.hive),
			Coin.hive,
			out,
			1,
			'ETH',
			'0x00000000000000000000000000000000000000e2',
			21_812,
			true,
			limit
		);
		return JSON.parse(JSON.parse(op[1].json).payload);
	}
	it('carries the sized limit on an ETH payout', async () => {
		expect((await payloadOf(Coin.eth, 25_200)).payout_gas_limit).toBe(25_200);
	});
	it('leaves it out for a token payout or when there is no estimate', async () => {
		expect((await payloadOf(Coin.usdc, 25_200)).payout_gas_limit).toBeUndefined();
		expect((await payloadOf(Coin.eth, null)).payout_gas_limit).toBeUndefined();
	});
});
