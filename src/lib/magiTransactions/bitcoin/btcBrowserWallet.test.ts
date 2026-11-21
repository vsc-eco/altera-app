import { describe, expect, it, vi } from 'vitest';
import {
	btcAddressNetwork,
	detectBtcBrowserWallets,
	MIN_BTC_DEPOSIT_SATS,
	sendBtcFromBrowserWallet
} from './btcBrowserWallet';

const DEPOSIT = 'bc1q0njy8qeuwze6vshdmnns3p0talp9rw0n5egyn8mau83zqztxm0jspp0ghv';
const PAYER = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const TESTNET_PAYER = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const TXID = 'a'.repeat(64);

function leather(opts: { from?: string; send?: (p: unknown) => unknown } = {}) {
	const request = vi.fn(async (method: string, params?: unknown) => {
		if (method === 'getAddresses')
			return {
				jsonrpc: '2.0',
				result: {
					addresses: [
						{ symbol: 'BTC', type: 'p2tr', address: 'bc1p' + 'x'.repeat(58) },
						{ symbol: 'BTC', type: 'p2wpkh', address: opts.from ?? PAYER },
						{ symbol: 'STX', address: 'SP000' }
					]
				}
			};
		if (method === 'sendTransfer')
			return opts.send ? opts.send(params) : { jsonrpc: '2.0', result: { txid: TXID } };
		throw new Error('unexpected ' + method);
	});
	return { LeatherProvider: { request }, request };
}

function xverse(opts: { send?: (p: unknown) => unknown } = {}) {
	const request = vi.fn(async (method: string, params?: unknown) => {
		if (method === 'getAccounts')
			return {
				result: [
					{ address: 'bc1p' + 'y'.repeat(58), purpose: 'ordinals' },
					{ address: PAYER, purpose: 'payment' }
				]
			};
		if (method === 'sendTransfer')
			return opts.send ? opts.send(params) : { result: { txid: TXID } };
		throw new Error('unexpected ' + method);
	});
	return { XverseProviders: { BitcoinProvider: { request } }, request };
}

describe('detectBtcBrowserWallets', () => {
	it('lists the installed wallets, in a fixed order', () => {
		const w = { ...xverse(), ...leather(), unisat: { requestAccounts: vi.fn(), sendBitcoin: vi.fn() } };
		expect(detectBtcBrowserWallets(w).map((x) => x.name)).toEqual(['Leather', 'Xverse', 'Unisat']);
	});
	it('none installed: an empty list (the page shows the address and QR only)', () => {
		expect(detectBtcBrowserWallets({ ethereum: {} })).toEqual([]);
	});
});

describe('sendBtcFromBrowserWallet', () => {
	const base = { recipient: DEPOSIT, amountSats: 50_000, network: 'mainnet' as const };

	it('Leather: connects, then one sendTransfer with the amount as a string of sats and network mainnet', async () => {
		const w = leather();
		const r = await sendBtcFromBrowserWallet({ ...base, walletId: 'leather' }, w);
		expect(r).toEqual({ txid: TXID, from: PAYER });
		const sends = w.request.mock.calls.filter((c) => c[0] === 'sendTransfer');
		expect(sends).toHaveLength(1);
		expect(sends[0][1]).toEqual({
			recipients: [{ address: DEPOSIT, amount: '50000' }],
			network: 'mainnet'
		});
	});

	it('Xverse: payment account, then sendTransfer with the amount as a number', async () => {
		const w = xverse();
		const r = await sendBtcFromBrowserWallet({ ...base, walletId: 'xverse' }, w);
		expect(r.txid).toBe(TXID);
		const sends = w.request.mock.calls.filter((c) => c[0] === 'sendTransfer');
		expect(sends[0][1]).toEqual({ recipients: [{ address: DEPOSIT, amount: 50_000 }] });
	});

	it('Unisat: sendBitcoin(address, sats)', async () => {
		const sendBitcoin = vi.fn(async () => TXID);
		const w = { unisat: { requestAccounts: vi.fn(async () => [PAYER]), sendBitcoin } };
		await sendBtcFromBrowserWallet({ ...base, walletId: 'unisat' }, w);
		expect(sendBitcoin).toHaveBeenCalledWith(DEPOSIT, 50_000);
	});

	it('refuses under the bridge minimum before the wallet is asked', async () => {
		const w = leather();
		await expect(
			sendBtcFromBrowserWallet({ ...base, walletId: 'leather', amountSats: MIN_BTC_DEPOSIT_SATS - 1 }, w)
		).rejects.toThrow(/at least 1000 sats/);
		expect(w.request).not.toHaveBeenCalled();
	});

	it('refuses a wallet on testnet for a mainnet deposit address, before any send', async () => {
		const w = leather({ from: TESTNET_PAYER });
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'leather' }, w)).rejects.toThrow(
			/Leather is on Bitcoin testnet/
		);
		expect(w.request.mock.calls.some((c) => c[0] === 'sendTransfer')).toBe(false);
	});

	it('refuses a recipient that is not an address of the network', async () => {
		const w = leather();
		await expect(
			sendBtcFromBrowserWallet({ ...base, walletId: 'leather', recipient: 'not-an-address' }, w)
		).rejects.toThrow(/not a Bitcoin mainnet address/);
		expect(w.request).not.toHaveBeenCalled();
	});

	it('a rejection (returned or thrown) says nothing was sent, and is never retried', async () => {
		const w = leather({ send: () => ({ error: { code: 4001, message: 'User rejected request' } }) });
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'leather' }, w)).rejects.toThrow(
			/You rejected the payment in Leather. Nothing was sent./
		);
		expect(w.request.mock.calls.filter((c) => c[0] === 'sendTransfer')).toHaveLength(1);
		const x = xverse({
			send: () => {
				throw { error: { code: -32000, message: 'User rejected' } };
			}
		});
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'xverse' }, x)).rejects.toThrow(
			/You rejected the payment in Xverse/
		);
	});

	it('no txid back: warns to check the wallet before sending again', async () => {
		const w = leather({ send: () => ({ result: {} }) });
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'leather' }, w)).rejects.toThrow(
			/returned no transaction id/
		);
	});

	it('not installed: a clear error, no call', async () => {
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'xverse' }, {})).rejects.toThrow(
			/Xverse is not installed/
		);
	});
});

describe('btcAddressNetwork', () => {
	it('tells mainnet from testnet', () => {
		expect(btcAddressNetwork(DEPOSIT)).toBe('mainnet');
		expect(btcAddressNetwork(PAYER)).toBe('mainnet');
		expect(btcAddressNetwork(TESTNET_PAYER)).toBe('testnet');
		expect(btcAddressNetwork('0x1234')).toBe(null);
	});
});

describe('the wallet must be on Bitcoin mainnet', () => {
	const base = { recipient: DEPOSIT, amountSats: 50_000, network: 'mainnet' as const };
	it('Unisat on Fractal Bitcoin (also bc1 addresses) is refused before any send', async () => {
		const sendBitcoin = vi.fn(async () => TXID);
		const w = {
			unisat: {
				requestAccounts: vi.fn(async () => [PAYER]),
				sendBitcoin,
				getChain: vi.fn(async () => ({ enum: 'FRACTAL_BITCOIN_MAINNET' }))
			}
		};
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'unisat' }, w)).rejects.toThrow(
			/another chain/
		);
		expect(sendBitcoin).not.toHaveBeenCalled();
	});
	it('Xverse reporting testnet4 is refused; reporting Mainnet goes ahead', async () => {
		const mk = (name: string) => {
			const request = vi.fn(async (method: string) => {
				if (method === 'getAccounts') return { result: [{ address: PAYER, purpose: 'payment' }] };
				if (method === 'wallet_getNetwork') return { result: { bitcoin: { name } } };
				return { result: { txid: TXID } };
			});
			return { XverseProviders: { BitcoinProvider: { request } }, request };
		};
		const t = mk('Testnet4');
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'xverse' }, t)).rejects.toThrow(
			/Bitcoin testnet/
		);
		expect(t.request.mock.calls.some((c) => c[0] === 'sendTransfer')).toBe(false);
		const m = mk('Mainnet');
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'xverse' }, m)).resolves.toMatchObject({
			txid: TXID
		});
	});
	it('a chain name the code does not know is not a refusal (fail open to the address check)', async () => {
		const request = vi.fn(async (method: string) => {
			if (method === 'getAccounts') return { result: [{ address: PAYER, purpose: 'payment' }] };
			if (method === 'wallet_getNetwork') return { result: { bitcoin: { name: 'BitcoinMain' } } };
			return { result: { txid: TXID } };
		});
		await expect(
			sendBtcFromBrowserWallet({ ...base, walletId: 'xverse' }, { XverseProviders: { BitcoinProvider: { request } } })
		).resolves.toMatchObject({ txid: TXID });
	});

	it('a payment address of no known network is refused', async () => {
		const w = leather({ from: 'not-an-address' });
		await expect(sendBtcFromBrowserWallet({ ...base, walletId: 'leather' }, w)).rejects.toThrow(
			/not a Bitcoin mainnet address/
		);
	});
});

