import { describe, expect, it } from 'vitest';
import {
	buildEvmSwapOps,
	evmSwapRcLimit,
	EVM_APPROVE_RC_LIMIT,
	EVM_SWAP_MAX_RC,
	EVM_SWAP_MIN_RC,
	headerRcLimit
} from './evmSwap';
import { BTC_PAYOUT_SWAP_MIN_RC } from '../hive/vscOperations/rcSizing';
import type { CallContractTransaction, Transaction } from './client';

const call = (rc_limit: number): CallContractTransaction => ({
	op: 'call',
	payload: { contract_id: 'c', action: 'a', payload: '{}', rc_limit, intents: [], caller: 'did' }
});
const plain = (op: string) => ({ op, payload: {} }) as unknown as Transaction;

describe('headerRcLimit', () => {
	it('covers a call that declares more than the old fixed header (mainnet refused 1000 < 10000)', () => {
		expect(headerRcLimit([call(10_000)])).toBe(10_000);
	});
	it('adds up every op, as the node does', () => {
		expect(headerRcLimit([call(1000), call(11_700)])).toBe(12_700);
		expect(headerRcLimit([call(3000), plain('transfer')])).toBe(3100);
		expect(headerRcLimit([call(3000), plain('stake_hbd'), plain('withdraw')])).toBe(3400);
	});
	it('counts a call under the node floor at the floor', () => {
		expect(headerRcLimit([call(5), call(995)])).toBe(1095);
	});
	it('keeps the old header for transactions that already passed', () => {
		expect(headerRcLimit([plain('transfer')])).toBe(1000);
		expect(headerRcLimit([call(1000)])).toBe(1000);
		expect(headerRcLimit([])).toBe(1000);
	});
});

describe('evmSwapRcLimit', () => {
	it('stays at the old limit when the account has plenty', () => {
		expect(evmSwapRcLimit(100_000, 5000, 0, false)).toEqual({ ok: true, rcLimit: EVM_SWAP_MAX_RC });
	});
	it('leaves an HBD input spendable (the node reserves the limit out of the HBD)', () => {
		// 12 HBD held, 10 HBD swapped: a limit of 10,000 would reserve it out from under the pull.
		expect(evmSwapRcLimit(12_000, 10_000, 0, false)).toEqual({ ok: true, rcLimit: 2000 });
	});
	it('leaves room for the allowance op in the header', () => {
		expect(evmSwapRcLimit(5000, 0, EVM_APPROVE_RC_LIMIT, false)).toEqual({
			ok: true,
			rcLimit: 4000
		});
	});
	it('refuses before signing when too little is left', () => {
		expect(evmSwapRcLimit(10_500, 10_000, 0, false)).toEqual({
			ok: false,
			reason: 'insufficient-rc',
			needed: EVM_SWAP_MIN_RC,
			available: 500
		});
		expect(evmSwapRcLimit(100, 500, 0, false)).toMatchObject({ ok: false, available: 0 });
	});
	it('sizes a BTC payout by the payout rule, net of the allowance op', () => {
		expect(evmSwapRcLimit(50_000, 0, 0, true)).toEqual({ ok: true, rcLimit: 50_000 });
		expect(evmSwapRcLimit(50_000, 10_000, EVM_APPROVE_RC_LIMIT, true)).toEqual({
			ok: true,
			rcLimit: 39_000
		});
		expect(evmSwapRcLimit(BTC_PAYOUT_SWAP_MIN_RC, 0, EVM_APPROVE_RC_LIMIT, true)).toMatchObject({
			ok: false,
			needed: BTC_PAYOUT_SWAP_MIN_RC
		});
	});
});

describe('buildEvmSwapOps', () => {
	const base = {
		caller: 'did:pkh:x',
		routerId: 'router',
		instruction: '{"type":"swap"}',
		rcLimit: 4000
	};

	it('a native input rides on a transfer.allow intent (mainnet: "no caller intent for: hbd")', () => {
		const ops = buildEvmSwapOps({
			...base,
			input: { kind: 'native', token: 'hbd', limit: '4.395' }
		});
		expect(ops).toHaveLength(1);
		expect(ops[0].payload).toMatchObject({
			contract_id: 'router',
			action: 'execute',
			payload: '{"type":"swap"}',
			rc_limit: 4000,
			caller: 'did:pkh:x',
			intents: [{ type: 'transfer.allow', args: { limit: '4.395', token: 'hbd' } }]
		});
	});
	it('a mapped input grants the router contract an allowance first, for the exact amount', () => {
		const ops = buildEvmSwapOps({
			...base,
			input: { kind: 'mapped', mappingContractId: 'btc-map', rawAmount: '1500' }
		});
		expect(ops.map((o) => o.payload.action)).toEqual(['increaseAllowance', 'execute']);
		expect(ops[0].payload.contract_id).toBe('btc-map');
		expect(JSON.parse(ops[0].payload.payload)).toEqual({
			spender: 'contract:router',
			amount: '1500'
		});
		expect(ops[0].payload.rc_limit).toBe(EVM_APPROVE_RC_LIMIT);
		expect(ops[1].payload.intents).toEqual([]);
	});
	it('its header covers both ops', () => {
		const ops = buildEvmSwapOps({
			...base,
			input: { kind: 'mapped', mappingContractId: 'btc-map', rawAmount: '1500' }
		});
		expect(headerRcLimit(ops)).toBe(5000);
	});
});
