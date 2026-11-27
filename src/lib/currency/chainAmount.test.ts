import { describe, expect, it } from 'vitest';
import { CoinAmount } from './CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { fromChainUnits, toChainUnits } from './chainAmount';

describe('chainAmount', () => {
	it('writes typed ETH amounts as exact wei digits, never exponent form', () => {
		expect(toChainUnits(new CoinAmount('0.011', Coin.eth))).toBe('11000000000000000');
		expect(toChainUnits(new CoinAmount('1234.5', Coin.eth))).toBe('1234500000000000000000');
		expect(String(new CoinAmount('1234.5', Coin.eth).amount)).toBe('1.2345e+21'); // why this exists
		expect(toChainUnits(new CoinAmount('0.123456789', Coin.eth))).toBe('123456789000000000');
		// a "max" amount (whole gwei from fromChainUnits) is sent unchanged
		const max = fromChainUnits('546741277517583625', Coin.eth);
		expect(toChainUnits(new CoinAmount(max, Coin.eth, true))).toBe('546741277000000000');
	});

	it('is String(amount) for every asset that fits a JS number', () => {
		for (const [v, c] of [
			['3', Coin.usdc],
			['0.00012345', Coin.btc],
			['1.5', Coin.hbd]
		] as const) {
			const a = new CoinAmount(v, c);
			expect(toChainUnits(a)).toBe(String(a.amount));
		}
	});

	it('reads a wei balance rounded down to whole gwei, never above the chain value', () => {
		for (const raw of ['546741277517583625', '1000000000000000000', '123456789012345678901', '1']) {
			const n = fromChainUnits(raw, Coin.eth);
			expect(BigInt(n) <= BigInt(raw)).toBe(true);
			expect(BigInt(raw) - BigInt(n) < 10n ** 9n + 4096n).toBe(true);
		}
		expect(fromChainUnits('546741277517583625', Coin.eth)).toBe(546741277000000000);
	});

	it('reads 6-place and smaller balances exactly, garbage as zero', () => {
		expect(fromChainUnits('3449999', Coin.usdc)).toBe(3449999);
		expect(fromChainUnits(undefined, Coin.eth)).toBe(0);
		expect(fromChainUnits('', Coin.usdc)).toBe(0);
		expect(fromChainUnits('x', Coin.usdc)).toBe(0);
		expect(fromChainUnits('-5', Coin.usdc)).toBe(0);
	});
});
