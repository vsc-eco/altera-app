/**
 * Add-liquidity op assembly.
 *
 * The router pulls a MAPPED asset with `transferFrom` on that asset's own
 * contract, which aborts with "Insufficient allowance" unless an approval is
 * already in place. Native HIVE/HBD instead ride in on `transfer.allow`
 * intents attached to the deposit op.
 *
 * This only ever covered BTC, so adding liquidity to a custom-token pool
 * always failed. The approve has to be a separate op in the SAME transaction,
 * ordered ahead of the deposit — which is what these tests pin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';

const fetchPoolTokensMock = vi.fn();
vi.mock('$lib/tokens/customTokens', () => ({
	fetchPoolTokens: (...args: unknown[]) => fetchPoolTokensMock(...args)
}));

const { addLiquidityTx } = await import('./index');

const LASSE_CONTRACT = 'vsc1BUDsVccMPGycTmpc98WsQYSKyTBsZqFq4h';
const LASSECASH = {
	value: 'lassecash',
	label: 'LASSECASH',
	icon: '/magi.svg',
	unit: 'LASSECASH',
	decimalPlaces: 8
};

const TOKEN = {
	symbol: 'lassecash',
	label: 'LASSECASH',
	name: 'LasseCash',
	decimals: 8,
	contractId: LASSE_CONTRACT,
	poolContractId: 'vsc1BrBFAwZ3Mr8L4ijRqT9RPEPvhK9FWDaYSr',
	routerRegistered: true
};

const POOL = { pairSymbols: ['HBD', 'LASSECASH'] } as never;

let broadcast: ReturnType<typeof vi.fn>;
const fakeAioha = () => ({ signAndBroadcastTx: broadcast }) as never;

/** Decode the vsc.call payloads from the ops handed to aioha. */
function sentOps() {
	const ops = broadcast.mock.calls[0][0] as Array<[string, { json: string }]>;
	return ops.map((op) => JSON.parse(op[1].json));
}

beforeEach(() => {
	broadcast = vi.fn().mockResolvedValue({ success: true, result: 'tx1' });
	fetchPoolTokensMock.mockResolvedValue([TOKEN]);
});
afterEach(() => {
	fetchPoolTokensMock.mockReset();
});

describe('addLiquidityTx — custom token side', () => {
	it('sends the allowance and the deposit as two ops in ONE transaction', async () => {
		await addLiquidityTx(
			new CoinAmount(1, Coin.hbd),
			new CoinAmount(1, LASSECASH),
			'tibfox',
			fakeAioha(),
			POOL
		);
		expect(broadcast).toHaveBeenCalledTimes(1);
		const ops = sentOps();
		expect(ops).toHaveLength(2);
		expect(ops[0].action).toBe('increaseAllowance');
		expect(JSON.parse(ops[1].payload).type).toBe('deposit');
	});

	it('orders the allowance BEFORE the deposit', async () => {
		await addLiquidityTx(
			new CoinAmount(1, Coin.hbd),
			new CoinAmount(1, LASSECASH),
			'tibfox',
			fakeAioha(),
			POOL
		);
		// Ops in one transaction execute in order, so a trailing approve would
		// still leave the router's pull unauthorised.
		expect(sentOps()[0].action).toBe('increaseAllowance');
	});

	it('approves on the TOKEN contract, sized to the token leg', async () => {
		const amount = new CoinAmount(2.5, LASSECASH);
		await addLiquidityTx(new CoinAmount(1, Coin.hbd), amount, 'tibfox', fakeAioha(), POOL);
		const approve = sentOps()[0];
		expect(approve.contract_id).toBe(LASSE_CONTRACT);
		expect(JSON.parse(approve.payload).amount).toBe(String(amount.amount));
	});

	it('works when the custom token is the FIRST amount', async () => {
		await addLiquidityTx(
			new CoinAmount(1, LASSECASH),
			new CoinAmount(1, Coin.hbd),
			'tibfox',
			fakeAioha(),
			POOL
		);
		expect(sentOps()[0].contract_id).toBe(LASSE_CONTRACT);
	});

	it('fails cleanly when the token contract cannot be resolved', async () => {
		fetchPoolTokensMock.mockResolvedValue([]);
		const res = await addLiquidityTx(
			new CoinAmount(1, Coin.hbd),
			new CoinAmount(1, LASSECASH),
			'tibfox',
			fakeAioha(),
			POOL
		);
		// Narrow the OperationResult union: `error` only exists on the failure
		// variant, so asserting `success` alone doesn't give TS the type.
		if (res.success) throw new Error('expected the transaction to be refused');
		expect(res.error).toContain('LASSECASH');
		// Nothing broadcast: better than a transaction that aborts on chain.
		expect(broadcast).not.toHaveBeenCalled();
	});
});

describe('addLiquidityTx — native and BTC sides are unchanged', () => {
	it('sends only the deposit for an all-native pair, with transfer.allow intents', async () => {
		await addLiquidityTx(
			new CoinAmount(1, Coin.hbd),
			new CoinAmount(1, Coin.hive),
			'tibfox',
			fakeAioha(),
			POOL
		);
		const ops = sentOps();
		expect(ops).toHaveLength(1);
		expect(ops[0].intents.map((i: { type: string }) => i.type)).toEqual([
			'transfer.allow',
			'transfer.allow'
		]);
		// A native pair must not hit token discovery at all.
		expect(fetchPoolTokensMock).not.toHaveBeenCalled();
	});

	it('still prepends the BTC allowance on the mapping contract', async () => {
		await addLiquidityTx(
			new CoinAmount(1, Coin.hbd),
			new CoinAmount(0.001, Coin.btc),
			'tibfox',
			fakeAioha(),
			POOL
		);
		const ops = sentOps();
		expect(ops).toHaveLength(2);
		expect(ops[0].action).toBe('increaseAllowance');
		expect(ops[0].contract_id).not.toBe(LASSE_CONTRACT);
		expect(fetchPoolTokensMock).not.toHaveBeenCalled();
	});

	it('refuses a zero-amount side without broadcasting', async () => {
		const res = await addLiquidityTx(
			new CoinAmount(0, Coin.hbd),
			new CoinAmount(1, LASSECASH),
			'tibfox',
			fakeAioha(),
			POOL
		);
		expect(res.success).toBe(false);
		expect(broadcast).not.toHaveBeenCalled();
	});
});
