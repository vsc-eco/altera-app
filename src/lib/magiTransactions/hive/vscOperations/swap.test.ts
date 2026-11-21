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

	// 3,000 since 11-21 (was 2,000): a two-hop swap kept on Magi used 1,440 RC
	// in a mainnet dry run (USDC->BTC), under the 1.5x margin at 2,000.
	it('gives a swap that stays on Magi 3,000', async () => {
		expect(await rcLimitOf(undefined, 50_000)).toBe(3_000);
	});
});
