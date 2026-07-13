import { describe, it, expect } from 'vitest';
import { HbdStakeTxState } from '$lib/sendswap/utils/txState.svelte';
import { getHbdStakeOp, getHbdUnstakeOp } from '$lib/magiTransactions/hive/vscOperations/stake';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';

describe('sHBD stake / unstake — flow', () => {
	it('state defaults to stake mode; deposit-first is off until the details stage enables it', () => {
		const s = new HbdStakeTxState();
		expect(s.kind).toBe('hbdStake');
		expect(s.mode).toBe('stake');
		// The details stage flips this on for aioha+stake (allowDeposit); the
		// state itself defaults off so EVM wallets never carry a deposit flag.
		expect(s.shouldDeposit).toBe(false);
	});

	it('mode, amount and recipient collect on the state', () => {
		const s = new HbdStakeTxState();
		s.mode = 'unstake';
		s.fromAmount = '3.5';
		s.toUsername = 'alice';
		expect(s.mode).toBe('unstake');
		expect(s.fromAmount).toBe('3.5');
		expect(s.toUsername).toBe('alice');
	});

	it('stake op targets vsc.stake_hbd with hbd asset', () => {
		const op = getHbdStakeOp('alice', 'alice', new CoinAmount('10', Coin.hbd));
		expect(op[0]).toBe('custom_json');
		const payload = op[1] as { required_auths: string[]; id: string; json: string };
		expect(payload.id).toBe('vsc.stake_hbd');
		expect(payload.required_auths).toEqual(['alice']);
		const json = JSON.parse(payload.json);
		expect(json.from).toBe('hive:alice');
		expect(json.to).toBe('hive:alice');
		expect(json.asset).toBe('hbd');
	});

	// Unlike consensus staking (where `to` must equal `from`), sHBD staking
	// legitimately supports a different recipient — the sHBD lands in their
	// savings. The review stage warns loudly when recipient !== self.
	it('stake op supports a recipient different from the sender', () => {
		const op = getHbdStakeOp('alice', 'bob', new CoinAmount('10', Coin.hbd));
		const json = JSON.parse((op[1] as { json: string }).json);
		expect(json.from).toBe('hive:alice');
		expect(json.to).toBe('hive:bob');
	});

	it('unstake op targets vsc.unstake_hbd', () => {
		const op = getHbdUnstakeOp('bob', 'bob', new CoinAmount('5', Coin.hbd));
		const payload = op[1] as { required_auths: string[]; id: string; json: string };
		expect(payload.id).toBe('vsc.unstake_hbd');
		expect(payload.required_auths).toEqual(['bob']);
		const json = JSON.parse(payload.json);
		expect(json.from).toBe('hive:bob');
		expect(json.asset).toBe('hbd');
	});
});
