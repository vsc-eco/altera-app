/**
 * A swap on the /swap page signed by a Hive wallet from its Magi balance:
 * who the router pays ("Keep on Magi", "Send to address" on Magi or on a
 * chain), and the Ethereum payout (destination_chain ETH) for ETH/USDC.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Coin, Network } from './sendOptions';
import { SWAP_CONTRACT_ID } from '$lib/magiTransactions/hive/vscOperations/swap';
import { EVM_BRIDGE_CONTRACT_ID } from '$lib/constants';

const exec = vi.fn();
vi.mock('$lib/magiTransactions/hive', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/magiTransactions/hive')>()),
	executeTx: (...args: unknown[]) => exec(...args)
}));
vi.mock('$lib/tokens/customTokens', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/tokens/customTokens')>()),
	fetchCustomTokens: async () => []
}));
let rc: number | undefined = 50_000;
vi.mock('$lib/magiTransactions/hive/vscOperations/rcSizing', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/magiTransactions/hive/vscOperations/rcSizing')>()),
	fetchAccountRc: async () => rc
}));
vi.mock('./btcAddressGuard', () => ({ assertBtcRecipientAllowed: async () => {} }));

const { send } = await import('./sendUtils');
const { accountBalance } = await import('$lib/stores/currentBalance');
// The payout sizing asks the node for fresh RC from inside rcSizing (the mock
// above cannot reach that call); here the node does not answer, so it falls
// back to the balance store's RC, which each test sets.
const setRc = (n: number) =>
	accountBalance.update((b) => ({ ...b, bal: { ...b.bal, resource_credits: n } }));
const { SwapTxState } = await import('./txState.svelte');

const hive = {
	status: 'authenticated',
	value: { provider: 'aioha', username: 'alice', did: 'hive:alice', aioha: {} }
};
const ETH_TO = '0x00000000000000000000000000000000000000b2';

function swap(o: {
	from: typeof Coin.btc;
	to: typeof Coin.btc;
	toNet: (typeof Network)[keyof typeof Network];
	fromAmount: string;
	toAmount: string;
	toUsername: string;
	min: string;
}) {
	const s = new SwapTxState();
	s.from = { coin: o.from, network: Network.magi };
	s.to = { coin: o.to, network: o.toNet };
	s.fromAmount = o.fromAmount;
	s.toAmount = o.toAmount;
	s.toUsername = o.toUsername;
	s.minAmountOut = o.min;
	s.swapFeeBps = 30;
	return s;
}

type Call = { contract_id: string; action: string; payload: string; rc_limit: number };
const calls = (): Call[] =>
	(exec.mock.calls[0][1] as [string, { id: string; json: string }][])
		.filter(([, op]) => op.id === 'vsc.call')
		.map(([, op]) => JSON.parse(op.json));

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
	removeItem: (k: string) => void store.delete(k)
};

beforeEach(() => {
	store.clear();
	rc = 50_000;
	setRc(50_000);
	exec.mockReset();
	exec.mockResolvedValue({ success: true, result: 'tx1' });
});

const statuses: string[] = [];
const run = (details: unknown) =>
	send(details as never, hive as never, Network.magi, (m: string) => void statuses.push(m), undefined);

describe('send(): a Hive wallet swapping its Magi balance', () => {
	it('Keep on Magi (toUsername = own account): the caller is paid', async () => {
		await run(
			swap({ from: Coin.hbd, to: Coin.usdc, toNet: Network.magi, fromAmount: '1', toAmount: '0.9', toUsername: 'alice', min: '900000' })
		);
		const [c] = calls();
		expect(c.contract_id).toBe(SWAP_CONTRACT_ID);
		expect(JSON.parse(c.payload)).toMatchObject({ asset_in: 'HBD', asset_out: 'USDC', recipient: 'hive:alice' });
		expect(JSON.parse(c.payload).destination_chain).toBeUndefined();
	});

	it('Send to address on Magi pays that address, not the caller (M1)', async () => {
		await run(
			swap({ from: Coin.hbd, to: Coin.usdc, toNet: Network.magi, fromAmount: '1', toAmount: '0.9', toUsername: 'bob', min: '900000' })
		);
		expect(JSON.parse(calls()[0].payload).recipient).toBe('hive:bob');
	});

	it('Send to address on Magi with an EVM address pays its did:pkh, never hive:0x', async () => {
		await run(
			swap({ from: Coin.hbd, to: Coin.usdc, toNet: Network.magi, fromAmount: '1', toAmount: '0.9', toUsername: ETH_TO, min: '900000' })
		);
		const r = JSON.parse(calls()[0].payload).recipient;
		expect(r).toMatch(/^did:pkh:eip155:1:0x/i);
		expect(r.toLowerCase()).toBe(`did:pkh:eip155:1:${ETH_TO}`);
	});

	it('USDC on Magi -> HIVE kept on Magi: allowance on the EVM bridge for usdc, then the router', async () => {
		await run(
			swap({ from: Coin.usdc, to: Coin.hive, toNet: Network.magi, fromAmount: '5', toAmount: '60', toUsername: 'alice', min: '59000' })
		);
		const [approve, router] = calls();
		expect(approve.contract_id).toBe(EVM_BRIDGE_CONTRACT_ID);
		expect(approve.action).toBe('increaseAllowance');
		expect(JSON.parse(approve.payload)).toEqual({ spender: `contract:${SWAP_CONTRACT_ID}`, amount: '5000000', asset: 'usdc' });
		expect(JSON.parse(router.payload)).toMatchObject({ asset_in: 'USDC', asset_out: 'HIVE', amount_in: '5000000', recipient: 'hive:alice' });
	});

	it('USDC paid out on Ethereum: destination ETH, the 0x address, RC sized for the payout', async () => {
		statuses.length = 0;
		const res = await run(
			swap({ from: Coin.hbd, to: Coin.usdc, toNet: Network.ethMainnet, fromAmount: '10', toAmount: '9.4', toUsername: ETH_TO, min: '9000000' })
		);
		if (!exec.mock.calls.length) throw new Error(`not sent: ${String(res)} | ${statuses.join(' / ')}`);
		const [c] = calls();
		expect(JSON.parse(c.payload)).toMatchObject({ asset_in: 'HBD', asset_out: 'USDC', destination_chain: 'ETH', recipient: ETH_TO });
		// all spendable RC: 50,000 less the 10,000 the HBD drawn from Magi backs
		expect(c.rc_limit).toBe(40_000);
	});

	it('ETH paid out on Ethereum from USDC: allowance for usdc, destination ETH', async () => {
		await run(
			swap({ from: Coin.usdc, to: Coin.eth, toNet: Network.ethMainnet, fromAmount: '50', toAmount: '0.02', toUsername: ETH_TO, min: '19000000000000000' })
		);
		const [approve, router] = calls();
		expect(JSON.parse(approve.payload).asset).toBe('usdc');
		expect(JSON.parse(router.payload)).toMatchObject({ asset_in: 'USDC', asset_out: 'ETH', destination_chain: 'ETH', recipient: ETH_TO });
	});

	it('an Ethereum payout the account cannot pay RC for is refused before signing', async () => {
		rc = 6_000;
		setRc(6_000);
		const res = await run(
			swap({ from: Coin.hbd, to: Coin.usdc, toNet: Network.ethMainnet, fromAmount: '10', toAmount: '9.4', toUsername: ETH_TO, min: '9000000' })
		);
		expect(res).toBeInstanceOf(Error);
		expect(String(res)).toMatch(/Not enough RC to pay out to an Ethereum address/);
		expect(exec).not.toHaveBeenCalled();
	});

	it('HIVE paid out on Hive still names the hive: account (unchanged)', async () => {
		await run(
			swap({ from: Coin.usdc, to: Coin.hive, toNet: Network.hiveMainnet, fromAmount: '5', toAmount: '60', toUsername: '@bob', min: '59000' })
		);
		expect(JSON.parse(calls()[1].payload)).toMatchObject({ destination_chain: 'HIVE', recipient: 'hive:bob' });
	});
});
