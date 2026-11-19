import { describe, expect, it } from 'vitest';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { USDC_TOKEN_ADDRESS } from '$lib/constants';
import { getEvmTransferOp, getEvmUnmapCall, getEvmUnmapOp } from './evm';

const TO = '0x6266b79f55A3F0873e6d92FE76D33233ffCcbAeC';

describe('EVM bridge payloads (evm-mapping-contract TransferParams)', () => {
	it('withdraws ETH with unmapETH: amount in wei, the Ethereum address, deduct_fee when asked', () => {
		expect(getEvmUnmapCall(TO, new CoinAmount('0.011', Coin.eth), true)).toEqual({
			action: 'unmapETH',
			payload: { amount: '11000000000000000', to: TO, deduct_fee: true }
		});
		expect(getEvmUnmapCall(TO, new CoinAmount('0.011', Coin.eth)).payload).not.toHaveProperty(
			'deduct_fee'
		);
	});

	it('withdraws USDC with unmapERC20, naming the asset and its token contract', () => {
		expect(getEvmUnmapCall(TO, new CoinAmount('3', Coin.usdc))).toEqual({
			action: 'unmapERC20',
			payload: { amount: '3000000', to: TO, asset: 'usdc', token_address: USDC_TOKEN_ADDRESS }
		});
	});

	it('refuses an asset the bridge does not hold', () => {
		expect(() => getEvmUnmapCall(TO, new CoinAmount('1', Coin.btc))).toThrow();
	});

	it('signs the withdrawal as one vsc.call with the sized rc_limit', () => {
		const [type, op] = getEvmUnmapOp(
			'alice',
			'hive:alice',
			TO,
			new CoinAmount('2', Coin.usdc),
			4321
		);
		expect(type).toBe('custom_json');
		expect(op.id).toBe('vsc.call');
		expect(op.required_auths).toEqual(['alice']);
		const json = JSON.parse(op.json);
		expect(json).toMatchObject({ caller: 'hive:alice', action: 'unmapERC20', rc_limit: 4321 });
		expect(json.payload.amount).toBe('2000000');
	});

	it('moves ETH between Magi accounts with transfer, naming the asset', () => {
		const [, op] = getEvmTransferOp('alice', 'hive:bob', new CoinAmount('1234.5', Coin.eth));
		const json = JSON.parse(op.json);
		expect(json.action).toBe('transfer');
		expect(json.payload).toEqual({
			amount: '1234500000000000000000',
			to: 'hive:bob',
			asset: 'eth'
		});
	});
});
