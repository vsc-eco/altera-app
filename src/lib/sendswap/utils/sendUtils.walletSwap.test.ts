/**
 * A swap on the /swap page signed by a wallet account (EVM or Bitcoin wallet)
 * from its Magi balance.
 *
 * send() used to build these with getEVMOpType, which signs a transfer,
 * withdraw or unmap of the OUTPUT asset: BTC on Magi -> HBD signed "transfer
 * HBD", so no swap ran and any HBD the account held went out instead. They now
 * go through the DEX router, the same ops the QuickSwap card sends.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Coin, Network } from './sendOptions';
import { SWAP_CONTRACT_ID } from '$lib/magiTransactions/hive/vscOperations/swap';

const sign = vi.fn();
vi.mock('$lib/magiTransactions/eth/client', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/magiTransactions/eth/client')>()),
	createClient: () => ({}),
	signAndBrodcastTransaction: (...args: unknown[]) => sign(...args)
}));
vi.mock('$lib/auth/reown', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/auth/reown')>()),
	wagmiConfig: {}
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
const { SwapTxState, WithdrawTxState } = await import('./txState.svelte');
const { btcSigner } = await import('$lib/magiTransactions/bitcoin/signer');
const { wagmiSigner } = await import('$lib/magiTransactions/eth/wagmi');

const EVM_DID = 'did:pkh:eip155:1:0x00000000000000000000000000000000000000a1';
const BTC_ADDR = 'bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5';
const LEATHER_DID = `did:pkh:bip122:000000000019d6689c085ae165831e93:${BTC_ADDR}`;
const evm = {
	status: 'authenticated',
	value: { provider: 'reown', did: EVM_DID, address: '0xa1' }
};
const leather = {
	status: 'authenticated',
	value: { provider: 'reown', did: LEATHER_DID, address: BTC_ADDR }
};

function swap(o: {
	from: typeof Coin.btc;
	to: typeof Coin.btc;
	toNet: typeof Network.magi;
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

type SignedOp = {
	op: string;
	payload: { action?: string; contract_id?: string; payload?: string };
};
const signedOps = () => sign.mock.calls[0][0] as SignedOp[];

beforeEach(() => {
	rc = 50_000;
	sign.mockReset();
	sign.mockResolvedValue({ id: 'tx1' });
});

const run = (details: unknown, auth: unknown) =>
	send(details as never, auth as never, Network.magi, () => {}, undefined);

describe('send(): a wallet account swapping its Magi balance', () => {
	it('EVM wallet, BTC on Magi -> HBD on Magi: allowance + router execute, never a transfer', async () => {
		const res = await run(
			swap({
				from: Coin.btc,
				to: Coin.hbd,
				toNet: Network.magi,
				fromAmount: '0.0005',
				toAmount: '43.000',
				toUsername: 'someone-else',
				min: '42000'
			}),
			evm
		);
		expect(res).toEqual({ id: 'tx1' });
		expect(sign).toHaveBeenCalledTimes(1);
		expect(sign.mock.calls[0][1]).toBe(wagmiSigner);
		const ops = signedOps();
		expect(ops.map((o) => o.op)).toEqual(['call', 'call']);
		expect(ops.map((o) => o.payload.action)).toEqual(['increaseAllowance', 'execute']);
		expect(ops[1].payload.contract_id).toBe(SWAP_CONTRACT_ID);
		expect(JSON.parse(ops[1].payload.payload!)).toEqual({
			type: 'swap',
			version: '1.0.0',
			asset_in: 'BTC',
			asset_out: 'HBD',
			amount_in: '50000',
			min_amount_out: '42000',
			// Kept on Magi: the swapper is paid, as on the Hive wallet path.
			recipient: EVM_DID
		});
	});

	it('Bitcoin wallet, BTC on Magi -> HIVE on Hive: signed by the Bitcoin wallet', async () => {
		const res = await run(
			swap({
				from: Coin.btc,
				to: Coin.hive,
				toNet: Network.hiveMainnet,
				fromAmount: '0.0005',
				toAmount: '400.000',
				toUsername: 'alice',
				min: '390000'
			}),
			leather
		);
		expect(res).toEqual({ id: 'tx1' });
		expect(sign.mock.calls[0][1]).toBe(btcSigner);
		const exec = JSON.parse(signedOps()[1].payload.payload!);
		expect(exec).toMatchObject({
			asset_in: 'BTC',
			asset_out: 'HIVE',
			recipient: 'hive:alice',
			destination_chain: 'HIVE',
			min_amount_out: '390000'
		});
	});

	it('refuses before signing when the account cannot pay the RC', async () => {
		rc = 0;
		const res = await run(
			swap({
				from: Coin.btc,
				to: Coin.hbd,
				toNet: Network.magi,
				fromAmount: '0.0005',
				toAmount: '43.000',
				toUsername: '',
				min: '42000'
			}),
			leather
		);
		expect(res).toBeInstanceOf(Error);
		expect(sign).not.toHaveBeenCalled();
	});

	it('refuses before signing when the fee guard trips', async () => {
		const s = swap({
			from: Coin.btc,
			to: Coin.hbd,
			toNet: Network.magi,
			fromAmount: '0.0005',
			toAmount: '43.000',
			toUsername: '',
			min: '42000'
		});
		s.swapFeeBps = 5000;
		const res = await run(s, evm);
		expect(res).toBeInstanceOf(Error);
		expect(sign).not.toHaveBeenCalled();
	});

	it('a withdrawal of one coin still signs the withdraw', async () => {
		const w = new WithdrawTxState();
		w.from = { coin: Coin.hbd, network: Network.magi };
		w.to = { coin: Coin.hbd, network: Network.hiveMainnet };
		w.fromAmount = '1.000';
		w.toAmount = '1.000';
		w.toUsername = 'alice';
		const res = await run(w, evm);
		expect(res).toEqual({ id: 'tx1' });
		expect(signedOps().map((o) => o.op)).toEqual(['withdraw']);
	});
});
