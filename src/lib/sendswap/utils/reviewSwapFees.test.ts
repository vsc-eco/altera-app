import { describe, expect, it } from 'vitest';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { computeNetToAmountSmallest, isLightningWithdrawFlow } from './reviewSwapFees';

describe('isLightningWithdrawFlow', () => {
	it('returns true for Magi -> Lightning BTC withdraw', () => {
		expect(
			isLightningWithdrawFlow({
				kind: 'withdraw',
				fromNetwork: Network.magi.value,
				toNetwork: Network.lightning.value,
				fromCoin: Coin.btc.value,
				toCoin: Coin.btc.value
			})
		).toBe(true);
	});

	it('returns true for sats denomination on both sides', () => {
		expect(
			isLightningWithdrawFlow({
				kind: 'withdraw',
				fromNetwork: Network.magi.value,
				toNetwork: Network.lightning.value,
				fromCoin: Coin.sats.value,
				toCoin: Coin.sats.value
			})
		).toBe(true);
	});

	it('returns false for non-withdraw kind', () => {
		expect(
			isLightningWithdrawFlow({
				kind: 'swap',
				fromNetwork: Network.magi.value,
				toNetwork: Network.lightning.value,
				fromCoin: Coin.btc.value,
				toCoin: Coin.btc.value
			})
		).toBe(false);
	});

	it('returns false for non-lightning destination', () => {
		expect(
			isLightningWithdrawFlow({
				kind: 'withdraw',
				fromNetwork: Network.magi.value,
				toNetwork: Network.btcMainnet.value,
				fromCoin: Coin.btc.value,
				toCoin: Coin.btc.value
			})
		).toBe(false);
	});
});

describe('computeNetToAmountSmallest', () => {
	it('subtracts both gateway and Altera fees for lightning withdraw', () => {
		const net = computeNetToAmountSmallest({
			rawToAmount: 8000,
			gatewayFeeAmount: 202,
			alteraFeeAmount: 10,
			isLightningWithdraw: true,
			gatewayFeeCoinMatchesToCoin: true
		});
		expect(net).toBe(7788);
	});

	it('does not subtract gateway fee outside lightning withdraw flow', () => {
		const net = computeNetToAmountSmallest({
			rawToAmount: 8000,
			gatewayFeeAmount: 202,
			alteraFeeAmount: 10,
			isLightningWithdraw: false,
			gatewayFeeCoinMatchesToCoin: true
		});
		expect(net).toBe(7990);
	});

	it('does not subtract gateway fee if fee coin does not match output coin', () => {
		const net = computeNetToAmountSmallest({
			rawToAmount: 8000,
			gatewayFeeAmount: 202,
			alteraFeeAmount: 0,
			isLightningWithdraw: true,
			gatewayFeeCoinMatchesToCoin: false
		});
		expect(net).toBe(8000);
	});

	it('never returns a negative number', () => {
		const net = computeNetToAmountSmallest({
			rawToAmount: 50,
			gatewayFeeAmount: 100,
			alteraFeeAmount: 100,
			isLightningWithdraw: true,
			gatewayFeeCoinMatchesToCoin: true
		});
		expect(net).toBe(0);
	});
});
