import { afterEach, describe, expect, it } from 'vitest';
import { decodeFunctionData, erc20Abi, getAddress } from 'viem';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { ETH_CHAIN_ID, USDC_TOKEN_ADDRESS } from '$lib/constants';
import {
	MAGI_DEPOSIT_ABI,
	discoverBrowserWallets,
	magiDepositTxs,
	sendMagiDepositFromBrowserWallet,
	type Eip1193
} from './magiDeposit';

const DC = '0xc55F271dB1f0Ac7D5FF2FBC08c104CF05343ED08'; // mainnet MagiDeposit, generation 0
const FROM = '0xF434fb109Fb6467e4FC37345c48A8b23F11d329B';
const HIVE = 'hive:alice';

describe('MagiDeposit calls (account-mapping l1-deposit/MagiDeposit.sol)', () => {
	it('ETH: one deposit(recipient) call to the deposit contract carrying the value', () => {
		const txs = magiDepositTxs(new CoinAmount('0.005', Coin.eth), DC, HIVE);
		expect(txs).toHaveLength(1);
		expect(txs[0].to).toBe(getAddress(DC));
		expect(BigInt(txs[0].value)).toBe(5_000_000_000_000_000n);
		const d = decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: txs[0].data });
		expect(d.functionName).toBe('deposit');
		expect(d.args).toEqual([HIVE]);
	});

	it('USDC with no allowance: approve the deposit contract, then depositToken(USDC, amount, recipient)', () => {
		const txs = magiDepositTxs(new CoinAmount('5', Coin.usdc), DC, HIVE, 0n);
		expect(txs).toHaveLength(2);
		expect(txs[0].to).toBe(getAddress(USDC_TOKEN_ADDRESS));
		expect(BigInt(txs[0].value)).toBe(0n);
		const a = decodeFunctionData({ abi: erc20Abi, data: txs[0].data });
		expect(a.functionName).toBe('approve');
		expect(a.args).toEqual([getAddress(DC), 5_000_000n]);
		expect(txs[1].to).toBe(getAddress(DC));
		const d = decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: txs[1].data });
		expect(d.functionName).toBe('depositToken');
		expect(d.args).toEqual([getAddress(USDC_TOKEN_ADDRESS), 5_000_000n, HIVE]);
	});

	it('USDC with enough allowance: only the deposit', () => {
		const txs = magiDepositTxs(new CoinAmount('5', Coin.usdc), DC, HIVE, 5_000_000n);
		expect(txs).toHaveLength(1);
		expect(decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: txs[0].data }).functionName).toBe(
			'depositToken'
		);
	});

	it('refuses an asset the bridge does not hold', () => {
		expect(() => magiDepositTxs(new CoinAmount('1', Coin.btc), DC, HIVE)).toThrow();
	});
});

/** A wallet that records what the page asks and answers like MetaMask. */
function recordingWallet(opts: {
	chainId: string;
	allowance?: bigint;
	revert?: boolean;
	code?: string | null;
	balance?: bigint;
}) {
	const calls: { method: string; params?: unknown[] }[] = [];
	let chainId = opts.chainId;
	let n = 0;
	const wallet: Eip1193 = {
		async request({ method, params }) {
			calls.push({ method, params });
			switch (method) {
				case 'eth_requestAccounts':
					return [FROM];
				case 'eth_chainId':
					return chainId;
				case 'wallet_switchEthereumChain':
					chainId = (params?.[0] as { chainId: string }).chainId;
					return null;
				case 'eth_getCode':
					return opts.code === undefined ? '0x6080604052' : opts.code;
				case 'eth_getBalance':
					return '0x' + (opts.balance ?? 10n ** 30n).toString(16);
				case 'eth_call': {
					const data = (params?.[0] as { data: string }).data;
					const v = data.startsWith('0x70a08231') // balanceOf
						? (opts.balance ?? 10n ** 30n)
						: (opts.allowance ?? 0n); // allowance
					return '0x' + v.toString(16).padStart(64, '0');
				}
				case 'eth_sendTransaction':
					return '0x' + String(++n).padStart(64, '0');
				case 'eth_getTransactionReceipt':
					return { status: opts.revert ? '0x0' : '0x1' };
				default:
					throw new Error('unexpected ' + method);
			}
		}
	};
	return { wallet, calls };
}

describe('sendMagiDepositFromBrowserWallet', () => {
	it('switches the wallet to Ethereum mainnet, then sends the deposit from the shared account', async () => {
		const { wallet, calls } = recordingWallet({ chainId: '0xaa36a7' });
		const hash = await sendMagiDepositFromBrowserWallet(
			new CoinAmount('0.005', Coin.eth),
			DC,
			HIVE,
			wallet
		);
		expect(hash).toBe('0x' + '1'.padStart(64, '0'));
		expect(calls.map((c) => c.method)).toEqual([
			'eth_requestAccounts',
			'eth_chainId',
			'wallet_switchEthereumChain',
			'eth_getCode',
			'eth_getBalance',
			'eth_sendTransaction',
			'eth_getTransactionReceipt'
		]);
		expect(calls[2].params).toEqual([{ chainId: '0x' + ETH_CHAIN_ID.toString(16) }]);
		expect(calls[3].params).toEqual([getAddress(DC), 'latest']);
		const tx = calls[5].params?.[0] as {
			from: string;
			to: string;
			value: string;
			data: `0x${string}`;
		};
		expect(tx.from).toBe(FROM);
		expect(tx.to).toBe(getAddress(DC));
		expect(decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: tx.data }).args).toEqual([HIVE]);
	});

	it('USDC: reads the allowance, approves, waits for it, then deposits; returns the deposit hash', async () => {
		const { wallet, calls } = recordingWallet({ chainId: '0x1', allowance: 0n });
		const hash = await sendMagiDepositFromBrowserWallet(
			new CoinAmount('5', Coin.usdc),
			DC,
			HIVE,
			wallet
		);
		expect(hash).toBe('0x' + '2'.padStart(64, '0'));
		const sends = calls
			.filter((c) => c.method === 'eth_sendTransaction')
			.map((c) => c.params?.[0] as { to: string; data: `0x${string}` });
		expect(sends.map((t) => t.to)).toEqual([getAddress(USDC_TOKEN_ADDRESS), getAddress(DC)]);
		expect(decodeFunctionData({ abi: erc20Abi, data: sends[0].data }).functionName).toBe('approve');
		expect(decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: sends[1].data }).functionName).toBe(
			'depositToken'
		);
		expect(calls.some((c) => c.method === 'wallet_switchEthereumChain')).toBe(false);
	});

	it('a deposit contract with no code (not deployed yet after a rotation): nothing is sent', async () => {
		for (const code of ['0x', null]) {
			for (const coin of [Coin.eth, Coin.usdc]) {
				const { wallet, calls } = recordingWallet({ chainId: '0x1', code });
				await expect(
					sendMagiDepositFromBrowserWallet(new CoinAmount('5', coin), DC, HIVE, wallet)
				).rejects.toThrow(/not deployed yet/);
				expect(calls.some((c) => c.method === 'eth_sendTransaction')).toBe(false);
			}
		}
	});

	it('a wallet that holds less than the amount: nothing is sent, not even the approve (owner 11-20: 0.128 USDC for a 1 USDC deposit)', async () => {
		const usdc = recordingWallet({ chainId: '0x1', balance: 128_312n });
		await expect(
			sendMagiDepositFromBrowserWallet(new CoinAmount('1', Coin.usdc), DC, HIVE, usdc.wallet)
		).rejects.toThrow('This wallet holds 0.128312 USDC, less than the 1 USDC to deposit');
		expect(usdc.calls.some((c) => c.method === 'eth_sendTransaction')).toBe(false);
		const eth = recordingWallet({ chainId: '0x1', balance: 999_999_999_999_999n });
		await expect(
			sendMagiDepositFromBrowserWallet(new CoinAmount('0.001', Coin.eth), DC, HIVE, eth.wallet)
		).rejects.toThrow(/holds 0.000999999999999999 ETH, less than the 0.001 ETH/);
		expect(eth.calls.some((c) => c.method === 'eth_sendTransaction')).toBe(false);
	});

	it('exactly the amount is enough', async () => {
		const { wallet } = recordingWallet({ chainId: '0x1', balance: 1_000_000n });
		await expect(
			sendMagiDepositFromBrowserWallet(new CoinAmount('1', Coin.usdc), DC, HIVE, wallet)
		).resolves.toMatch(/^0x/);
	});

	it('a reverted transaction is an error, not a deposit', async () => {
		const { wallet } = recordingWallet({ chainId: '0x1', revert: true });
		await expect(
			sendMagiDepositFromBrowserWallet(new CoinAmount('0.005', Coin.eth), DC, HIVE, wallet)
		).rejects.toThrow(/reverted/);
	});
});

describe('discoverBrowserWallets (EIP-6963)', () => {
	const g = globalThis as unknown as Record<string, unknown>;
	const saved = {
		add: g.addEventListener,
		remove: g.removeEventListener,
		dispatch: g.dispatchEvent,
		eth: g.ethereum
	};
	afterEach(() => {
		g.addEventListener = saved.add;
		g.removeEventListener = saved.remove;
		g.dispatchEvent = saved.dispatch;
		g.ethereum = saved.eth;
	});

	it('lists every wallet that announces itself, once each', async () => {
		const target = new EventTarget();
		g.addEventListener = target.addEventListener.bind(target);
		g.removeEventListener = target.removeEventListener.bind(target);
		g.dispatchEvent = (e: Event) => {
			if (e.type === 'eip6963:requestProvider') {
				for (const [rdns, name] of [
					['io.metamask', 'MetaMask'],
					['io.rabby', 'Rabby'],
					['io.metamask', 'MetaMask']
				]) {
					target.dispatchEvent(
						Object.assign(new Event('eip6963:announceProvider'), {
							detail: { info: { rdns, name, uuid: rdns }, provider: { request: async () => null } }
						})
					);
				}
			}
			return true;
		};
		const ws = await discoverBrowserWallets(10);
		expect(ws.map((w) => w.name)).toEqual(['MetaMask', 'Rabby']);
	});

	it('falls back to window.ethereum when nothing announces itself, and finds nothing without a wallet', async () => {
		const target = new EventTarget();
		g.addEventListener = target.addEventListener.bind(target);
		g.removeEventListener = target.removeEventListener.bind(target);
		g.dispatchEvent = () => true;
		g.ethereum = { request: async () => null };
		expect((await discoverBrowserWallets(10)).map((w) => w.id)).toEqual(['window.ethereum']);
		g.ethereum = undefined;
		expect(await discoverBrowserWallets(10)).toEqual([]);
	});
});
