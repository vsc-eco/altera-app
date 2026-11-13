/**
 * A swap paid with Bitcoin from a Bitcoin wallet (Leather, Xverse, ...) on the
 * /swap page. Confirming the review must open the "Send Bitcoin" step (deposit
 * address from the mapping bot, then the wallet send), the same flow as the
 * QuickSwap card, and must not call the steps machine's `next` (send()), which
 * has no route for BTC still on L1. Every other swap still goes to `next`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { SwapTxState } from '$lib/sendswap/utils/txState.svelte';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';

const BTC_ADDR = 'bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5';
const LEATHER = {
	status: 'authenticated',
	value: {
		provider: 'reown',
		did: `did:pkh:bip122:000000000019d6689c085ae165831e93:${BTC_ADDR}`,
		address: BTC_ADDR
	}
};
const KEYCHAIN = {
	status: 'authenticated',
	value: { provider: 'aioha', did: 'hive:innopay', username: 'innopay', address: 'innopay' }
};
let auth: unknown = LEATHER;
vi.mock('$lib/auth/store', () => ({ getAuth: () => () => auth }));

const sendBtc = vi.fn();
vi.mock('$lib/magiTransactions/bitcoin/walletSend', () => ({
	sendBtcFromConnectedWallet: (p: unknown) => sendBtc(p)
}));

// USD readouts on the review are not under test: no price feed here.
vi.mock('$lib/currency/convert', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/currency/convert')>()),
	getExchangeRates: async () => null
}));

const DEPOSIT = 'bc1qdepositaddressxxxxxxxxxxxxxxxxxxxxxxxxx';
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { default: Harness } = await import('$lib/sendswap/testing/ReviewSwapHarness.svelte');

function swapState(opts: {
	fromNet?: Network;
	from?: Coin;
	to?: Coin;
	toNet?: Network;
	toUsername?: string;
}) {
	const s = new SwapTxState();
	s.from = { coin: opts.from ?? Coin.btc, network: opts.fromNet ?? Network.btcMainnet };
	s.to = { coin: opts.to ?? Coin.hbd, network: opts.toNet ?? Network.hiveMainnet };
	s.fromAmount = '0.0001';
	s.toAmount = '8.643';
	s.toUsername = opts.toUsername ?? 'innopay';
	return s;
}

function mappingBotCalls() {
	return fetchMock.mock.calls.filter(([url]) => url === '/api/mapping-bot');
}

beforeEach(() => {
	auth = LEATHER;
	sendBtc.mockReset();
	fetchMock.mockReset();
	fetchMock.mockImplementation(async (url: string) => {
		if (url === '/api/mapping-bot') {
			return new Response(JSON.stringify({ address: DEPOSIT, raw: 'x' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response('not in this test', { status: 503 });
	});
});

async function clickSwap() {
	const btn = await screen.findByRole('button', { name: 'Swap' });
	await fireEvent.click(btn);
}

describe('ReviewSwap: swap paid with Bitcoin from a Bitcoin wallet', () => {
	it('opens the Send Bitcoin step with a mapping-bot address instead of calling send()', async () => {
		const next = vi.fn();
		const goHome = vi.fn();
		render(Harness, { txState: swapState({}), next, goHome });
		await screen.findByRole('button', { name: 'Swap' });
		expect(goHome, 'the review opens without bouncing home').not.toHaveBeenCalled();

		await clickSwap();
		expect(next).not.toHaveBeenCalled();

		await screen.findByText('Send with connected wallet');
		const calls = mappingBotCalls();
		expect(calls).toHaveLength(1);
		expect(JSON.parse(calls[0][1].body)).toEqual({
			instruction: 'swap_to=hive%3Ainnopay&swap_asset_out=hbd&destination_chain=HIVE',
			network: 'mainnet'
		});
		expect(screen.getByText(/Do not save this address/)).toBeTruthy();
		expect(screen.getByText(/forwards the swap to/).textContent).toContain('innopay');

		sendBtc.mockResolvedValue('a'.repeat(64));
		await fireEvent.click(screen.getByText('Send with connected wallet'));
		await screen.findByText(/Bitcoin sent/);
		expect(sendBtc, 'wallet sends').toHaveBeenCalledTimes(1);
		expect(sendBtc).toHaveBeenCalledWith({
			amountSats: 10000,
			recipient: DEPOSIT,
			fallbackAddress: BTC_ADDR
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(goHome, 'goHome calls').toHaveBeenCalledTimes(1);
		expect(next).not.toHaveBeenCalled();
	});

	it('keeps the output on Magi for "Keep on Magi" (own BTC address, no destination_chain)', async () => {
		render(Harness, {
			txState: swapState({ toNet: Network.magi, toUsername: BTC_ADDR }),
			next: vi.fn(),
			goHome: vi.fn()
		});
		await clickSwap();
		await screen.findByText('Send with connected wallet');
		expect(JSON.parse(mappingBotCalls()[0][1].body).instruction).toBe(
			new URLSearchParams({ swap_to: LEATHER.value.did, swap_asset_out: 'hbd' }).toString()
		);
	});

	it('sends once on a double click and lets the user retry after a wallet rejection', async () => {
		render(Harness, { txState: swapState({}), next: vi.fn(), goHome: vi.fn() });
		await clickSwap();
		const send = await screen.findByText('Send with connected wallet');

		let reject!: (e: Error) => void;
		sendBtc.mockImplementationOnce(() => new Promise((_, r) => (reject = r)));
		await fireEvent.click(send);
		await fireEvent.click(send);
		await waitFor(() => expect(sendBtc).toHaveBeenCalledTimes(1));
		// The wallet module loads lazily; give a second call every chance to land.
		await new Promise((r) => setTimeout(r, 50));
		expect(sendBtc, 'wallet sends after a double click').toHaveBeenCalledTimes(1);

		reject(new Error('User rejected the request'));
		await screen.findByText('User rejected the request');

		sendBtc.mockResolvedValueOnce('b'.repeat(64));
		await fireEvent.click(screen.getByText('Send with connected wallet'));
		await screen.findByText(/Bitcoin sent/);
		expect(sendBtc).toHaveBeenCalledTimes(2);
	});

	it('shows a mapping-bot failure and goes back to the review', async () => {
		fetchMock.mockImplementation(async () => new Response('upstream down', { status: 502 }));
		render(Harness, { txState: swapState({}), next: vi.fn(), goHome: vi.fn() });
		await clickSwap();
		await screen.findByText('Mapping bot error (502): upstream down');
		expect(sendBtc).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
		await screen.findByRole('button', { name: 'Swap' });
	});

	it('refuses a Hive payout to a non-Hive receiver without asking the mapping bot', async () => {
		render(Harness, {
			txState: swapState({ toUsername: BTC_ADDR }),
			next: vi.fn(),
			goHome: vi.fn()
		});
		await clickSwap();
		await screen.findByText('Enter a Hive account to receive on Hive.');
		expect(mappingBotCalls()).toHaveLength(0);
	});
});

describe('ReviewSwap: every other swap still confirms through next()', () => {
	it('Bitcoin wallet, BTC already on Magi', async () => {
		const next = vi.fn();
		render(Harness, {
			txState: swapState({ fromNet: Network.magi, toNet: Network.magi }),
			next,
			goHome: vi.fn()
		});
		await clickSwap();
		expect(next).toHaveBeenCalledTimes(1);
		expect(mappingBotCalls()).toHaveLength(0);
	});

	it('Hive wallet, HBD on Hive to HIVE', async () => {
		auth = KEYCHAIN;
		const next = vi.fn();
		render(Harness, {
			txState: swapState({
				from: Coin.hbd,
				fromNet: Network.hiveMainnet,
				to: Coin.hive,
				toNet: Network.hiveMainnet
			}),
			next,
			goHome: vi.fn()
		});
		await clickSwap();
		expect(next).toHaveBeenCalledTimes(1);
		expect(mappingBotCalls()).toHaveLength(0);
	});
});
