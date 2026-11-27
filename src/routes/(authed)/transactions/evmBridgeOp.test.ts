import { describe, expect, it } from 'vitest';
import type { TransactionOpType } from '$lib/stores/txStores';
import { evmBridgeOpAsTransfer } from './evmBridgeOp';

const BRIDGE = 'vsc1Bo8h3TMFAYX5rkgCeauXFywZGiMbUftQL2';
const SENDER = 'did:pkh:eip155:1:0x9804b6E1958A8e325471D81125E232AEB1Da5b90';

// The op shapes the node returns for these calls (testnet, 2026-11-19).
const call = (action: string, payload: object, contract = BRIDGE) =>
	({
		index: 0,
		type: 'call',
		data: { action, contract_id: contract, intents: [], payload: JSON.stringify(payload) }
	}) as unknown as TransactionOpType;

describe('evmBridgeOpAsTransfer', () => {
	it('shows a bridge transfer as an ETH or USDC transfer, not a BTC one', () => {
		const eth = evmBridgeOpAsTransfer(
			call('transfer', { amount: '1000000000000000', to: 'hive:lordbutterfly', asset: 'eth' }),
			SENDER,
			BRIDGE
		);
		expect(eth?.type).toBe('transfer');
		expect(eth?.data).toEqual({
			from: SENDER,
			to: 'hive:lordbutterfly',
			asset: 'eth',
			amount: 1_000_000_000_000_000
		});
		const usdc = evmBridgeOpAsTransfer(
			call('transfer', { amount: '500000', to: 'hive:lordbutterfly', asset: 'usdc' }),
			SENDER,
			BRIDGE
		);
		expect(usdc?.data).toMatchObject({ asset: 'usdc', amount: 500_000 });
	});

	it('checksums an Ethereum recipient so it matches that account as incoming', () => {
		const op = evmBridgeOpAsTransfer(
			call('transfer', {
				amount: '1',
				to: 'did:pkh:eip155:1:0x9804b6e1958a8e325471d81125e232aeb1da5b90',
				asset: 'eth'
			}),
			'hive:alice',
			BRIDGE
		);
		expect(op?.data.to).toBe(SENDER);
	});

	it('shows unmapETH / unmapERC20 as withdrawals to the Ethereum address', () => {
		const eth = evmBridgeOpAsTransfer(
			call('unmapETH', { amount: '11000000000000000', to: '0xabc', deduct_fee: true }),
			SENDER,
			BRIDGE
		);
		expect(eth?.type).toBe('withdraw');
		expect(eth?.data).toMatchObject({ from: SENDER, to: '0xabc', asset: 'eth' });
		const usdc = evmBridgeOpAsTransfer(
			call('unmapERC20', { amount: '3000000', to: '0xabc', asset: 'usdc', token_address: '0x1' }),
			SENDER,
			BRIDGE
		);
		expect(usdc?.data).toMatchObject({ asset: 'usdc', amount: 3_000_000 });
	});

	it('leaves every other call alone', () => {
		// Same action on another contract (BTC mapping, a custom token).
		expect(
			evmBridgeOpAsTransfer(
				call('transfer', { amount: '1', to: 'hive:a' }, 'vsc1Other'),
				SENDER,
				BRIDGE
			)
		).toBeNull();
		// Other bridge actions, unknown assets, unreadable payloads, a disabled bridge.
		expect(
			evmBridgeOpAsTransfer(call('increaseAllowance', { amount: '1' }), SENDER, BRIDGE)
		).toBeNull();
		expect(
			evmBridgeOpAsTransfer(
				call('transfer', { amount: '1', to: 'hive:a', asset: 'btc' }),
				SENDER,
				BRIDGE
			)
		).toBeNull();
		const bad = {
			...call('transfer', {}),
			data: { action: 'transfer', contract_id: BRIDGE, payload: '{' }
		};
		expect(evmBridgeOpAsTransfer(bad as unknown as TransactionOpType, SENDER, BRIDGE)).toBeNull();
		expect(
			evmBridgeOpAsTransfer(
				call('transfer', { amount: '1', to: 'hive:a', asset: 'eth' }),
				SENDER,
				''
			)
		).toBeNull();
	});
});
