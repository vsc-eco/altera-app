import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TransactionOpType } from '$lib/stores/txStores';

/**
 * The real bug this guards (mainnet tx 33f3a959…, 2026-11-27): risingstarhub
 * sent 0.3 STARPRO to jef-001, and the table showed "0.0003 BTC ≈ $17.89",
 * from and to both jef-001, under the BTC mapping contract's id. The action
 * name `transfer` is not the BTC contract's alone.
 */
const STARPRO = 'vsc1Bfaa2m3GHWL1baZ9AdDjgXQr2MHXMvoTgA';
const NOT_A_TOKEN = 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d';

vi.mock('$lib/tokens/assetCoin.svelte', () => ({
	tokenForContract: (contractId: string | undefined | null) =>
		contractId === STARPRO
			? { value: 'starpro', label: 'STARPRO', icon: '/tokens/starpro.png', unit: 'STARPRO', decimalPlaces: 5 }
			: undefined
}));

const { customTokenOpAsTransfer } = await import('./customTokenOp');

const call = (action: string, payload: object, contract = STARPRO) =>
	({
		index: 0,
		type: 'call',
		data: { action, contract_id: contract, intents: [], payload: JSON.stringify(payload) }
	}) as unknown as TransactionOpType;

beforeEach(() => vi.clearAllMocks());

describe('customTokenOpAsTransfer', () => {
	it('reads a token transfer as that token, in its own smallest units', () => {
		const op = customTokenOpAsTransfer(
			call('transfer', { to: 'hive:jef-001', amount: '30000' }),
			'hive:risingstarhub'
		);
		expect(op?.type).toBe('transfer');
		// 30000 at 5 decimals = 0.3 STARPRO. Not 30000 sats of BTC.
		expect(op?.data).toEqual({
			from: 'hive:risingstarhub',
			to: 'hive:jef-001',
			asset: 'starpro',
			amount: 30_000
		});
	});

	it('names the SIGNER as the sender, not whoever is looking at the row', () => {
		const op = customTokenOpAsTransfer(
			call('transfer', { to: 'hive:jef-001', amount: '30000' }),
			'hive:risingstarhub'
		);
		expect(op?.data.from).toBe('hive:risingstarhub');
		expect(op?.data.from).not.toBe(op?.data.to);
	});

	it('transferFrom debits the account whose allowance is spent', () => {
		const op = customTokenOpAsTransfer(
			call('transferFrom', { from: 'hive:alice', to: 'hive:bob', amount: '7' }),
			'hive:spender'
		);
		expect(op?.data).toMatchObject({ from: 'hive:alice', to: 'hive:bob' });
	});

	it('leaves a contract that is not a token alone', () => {
		expect(
			customTokenOpAsTransfer(
				call('transfer', { to: 'hive:jef-001', amount: '30000' }, NOT_A_TOKEN),
				'hive:risingstarhub'
			)
		).toBeNull();
	});

	it('leaves other actions and non-call ops alone', () => {
		expect(
			customTokenOpAsTransfer(call('mint', { amount: '1' }), 'hive:risingstarhub')
		).toBeNull();
		expect(
			customTokenOpAsTransfer(
				{ index: 0, type: 'transfer', data: {} } as unknown as TransactionOpType,
				'hive:risingstarhub'
			)
		).toBeNull();
	});

	it('refuses a call it cannot read rather than inventing an amount', () => {
		const broken = {
			index: 0,
			type: 'call',
			data: { action: 'transfer', contract_id: STARPRO, payload: '{not json' }
		} as unknown as TransactionOpType;
		expect(customTokenOpAsTransfer(broken, 'hive:a')).toBeNull();
		expect(
			customTokenOpAsTransfer(call('transfer', { to: 'hive:b', amount: '0' }), 'hive:a')
		).toBeNull();
		expect(
			customTokenOpAsTransfer(call('transfer', { amount: '5' }), 'hive:a')
		).toBeNull();
	});
});
