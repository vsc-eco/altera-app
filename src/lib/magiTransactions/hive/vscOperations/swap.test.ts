import { describe, expect, it, vi } from 'vitest';

// swap.ts pulls in the price API for the (inactive) Altera fee; the op shape
// under test never calls it.
vi.mock('$lib/sendswap/v4v/api-types/cryptoprices', () => ({ getCryptoPrices: vi.fn() }));

import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { getHiveSwapOp } from './swap';

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
