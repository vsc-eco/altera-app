import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodeFunctionData, erc20Abi, getAddress } from 'viem';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { ETH_CHAIN_ID, USDC_TOKEN_ADDRESS } from '$lib/constants';
import {
	MAGI_DEPOSIT_ABI,
	depositTiming,
	discoverBrowserWallets,
	magiDepositAddressFor,
	magiDepositTxs,
	sendMagiDepositFromBrowserWallet,
	watchBrowserWallets,
	type Eip1193
} from './magiDeposit';

// The real mainnet pair: generation 0's vault and its MagiDeposit (CREATE2).
const VAULT = '0x88161a75f8519d0d333c83012df78ada5fff796a';
const DC = '0xc55F271dB1f0Ac7D5FF2FBC08c104CF05343ED08';
const FROM = '0xF434fb109Fb6467e4FC37345c48A8b23F11d329B';
const SIX = '0x6666666666666666666666666666666666666666';
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

describe('magiDepositAddressFor (the bridge derivation: CREATE2, deployer, salt 0, vault)', () => {
	it('yields the real deployed contracts: mainnet generation 0 and Sepolia generation 11', () => {
		expect(magiDepositAddressFor(VAULT)).toBe(getAddress(DC));
		expect(magiDepositAddressFor('0xe3cc9a205bc46538eb0b1c7fe291ee0de765c43e')).toBe(
			'0x9cbe4Cf36d89A11FB584E514b6BB9d6177416096'
		);
	});
});

type Call = { method: string; params?: unknown[] };
/**
 * A MetaMask-like wallet over a tiny Ethereum: several accounts, the account
 * picker (wallet_requestPermissions), chain switching, ETH and USDC balances,
 * allowances, the spending cap the user can edit on the approve screen,
 * nonces, gas estimation that reverts like the chain would, and a speed-up
 * that replaces a transaction. It records every request.
 */
function fakeWallet(o: {
	chainId?: string;
	accounts?: string[]; // permitted accounts, chosen first
	pick?: string; // the account the user picks in the picker
	picker?: 'ok' | 'reject' | 'pending' | 'unsupported' | 'odd';
	switchChain?: 'ok' | 'ignore' | 'reject';
	eth?: Record<string, bigint>;
	usdc?: Record<string, bigint>;
	allowance?: bigint;
	cap?: bigint; // the spending cap the user typed on the approve screen
	speedUp?: number; // replace the n-th sent transaction (0-based) with a new hash
	allowanceLag?: number; // reads of the allowance that still show the old value after an approve
	estimateLag?: number; // deposit simulations that still revert after an approve (a lagging node)
	code?: string;
	gasPrice?: bigint;
}) {
	const calls: Call[] = [];
	let chainId = o.chainId ?? '0x1';
	let permitted = o.accounts ?? [FROM];
	const eth: Record<string, bigint> = { [FROM]: 10n ** 18n, [SIX]: 0n, ...(o.eth ?? {}) };
	const usdc: Record<string, bigint> = { [FROM]: 100_000_000n, [SIX]: 0n, ...(o.usdc ?? {}) };
	let allowance = o.allowance ?? 0n;
	let before = allowance;
	let lagLeft = 0;
	let estLagLeft = 0;
	const nonce: Record<string, bigint> = {};
	const txs = new Map<string, { status: string; nonce: bigint }>();
	let sent = 0;
	const usdcAddr = getAddress(USDC_TOKEN_ADDRESS).toLowerCase();
	const sim = (tx: { from: string; to: string; value: string; data: `0x${string}` }) => {
		const to = tx.to.toLowerCase();
		const from = getAddress(tx.from);
		if (to === usdcAddr) {
			const d = decodeFunctionData({ abi: erc20Abi, data: tx.data });
			return () => {
				if (d.functionName === 'approve') {
					before = allowance;
					lagLeft = o.allowanceLag ?? 0;
					estLagLeft = o.estimateLag ?? 0;
					allowance = o.cap ?? (d.args[1] as bigint);
				}
			};
		}
		if (to === DC.toLowerCase()) {
			const d = decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: tx.data });
			if (d.functionName === 'deposit') {
				if ((eth[from] ?? 0n) < BigInt(tx.value)) throw new Error('insufficient funds');
				return () => (eth[from] -= BigInt(tx.value));
			}
			const amt = d.args[1] as bigint;
			if (allowance < amt || (usdc[from] ?? 0n) < amt)
				throw Object.assign(new Error('execution reverted'), { code: 3, data: '0x045c4b02' });
			return () => {
				usdc[from] -= amt;
				allowance -= amt;
			};
		}
		throw new Error('unexpected contract ' + tx.to);
	};
	const wallet: Eip1193 = {
		async request({ method, params }) {
			calls.push({ method, params });
			const p0 = params?.[0] as Record<string, string>;
			switch (method) {
				case 'wallet_requestPermissions':
					if (o.picker === 'reject')
						throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
					if (o.picker === 'pending')
						throw Object.assign(new Error('Request already pending'), { code: -32002 });
					if (o.picker === 'unsupported')
						throw Object.assign(new Error('Method not found'), { code: -32601 });
					if (o.picker === 'odd')
						throw Object.assign(new Error('Internal error'), { code: -32603 });
					if (o.pick) permitted = [o.pick, ...permitted.filter((a) => a !== o.pick)];
					return [{ parentCapability: 'eth_accounts' }];
				case 'eth_requestAccounts':
					return permitted;
				case 'eth_chainId':
					return chainId;
				case 'wallet_switchEthereumChain':
					if (o.switchChain === 'reject')
						throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
					if (o.switchChain !== 'ignore') chainId = (p0 as unknown as { chainId: string }).chainId;
					return null;
				case 'eth_getCode':
					return o.code ?? '0x6080604052';
				case 'eth_getBalance':
					return '0x' + (eth[getAddress(params?.[0] as string)] ?? 0n).toString(16);
				case 'eth_call': {
					const d = decodeFunctionData({ abi: erc20Abi, data: p0.data as `0x${string}` });
					let v =
						d.functionName === 'balanceOf'
							? (usdc[getAddress(d.args[0] as string)] ?? 0n)
							: allowance;
					if (d.functionName === 'allowance' && lagLeft > 0) {
						lagLeft--;
						v = before;
					}
					return '0x' + v.toString(16).padStart(64, '0');
				}
				case 'eth_estimateGas':
					if (estLagLeft > 0 && (p0.data as string).startsWith('0xa10d0960')) {
						estLagLeft--;
						throw Object.assign(new Error('execution reverted'), { code: 3, data: '0x045c4b02' });
					}
					sim(p0 as never);
					return '0x' + (60_000).toString(16);
				case 'eth_gasPrice':
					return '0x' + (o.gasPrice ?? 1_000_000_000n).toString(16);
				case 'eth_sendTransaction': {
					const from = getAddress(p0.from);
					if (!permitted.map((a) => getAddress(a)).includes(from))
						throw new Error('from is not a permitted account');
					const apply = sim(p0 as never);
					apply();
					const n = nonce[from] ?? 0n;
					nonce[from] = n + 1n;
					const hash = ('0x' + String(++sent).padStart(64, 'a')) as string;
					if (o.speedUp === sent - 1) {
						// the user sped it up: another hash with the same nonce is mined
						txs.set(hash, { status: 'replaced', nonce: n });
						txs.set('0x' + String(sent).padStart(64, 'b'), { status: '0x1', nonce: n });
					} else txs.set(hash, { status: '0x1', nonce: n });
					return hash;
				}
				case 'eth_getTransactionReceipt': {
					const t = txs.get(params?.[0] as string);
					return t && t.status !== 'replaced' ? { status: t.status } : null;
				}
				case 'eth_getTransactionByHash': {
					const t = txs.get(params?.[0] as string);
					return t ? { nonce: '0x' + t.nonce.toString(16) } : null;
				}
				case 'eth_getTransactionCount':
					return '0x' + (nonce[getAddress(params?.[0] as string)] ?? 0n).toString(16);
				default:
					throw new Error('unexpected ' + method);
			}
		}
	};
	const sends = () =>
		calls
			.filter((c) => c.method === 'eth_sendTransaction')
			.map(
				(c) => c.params?.[0] as { from: string; to: string; value: string; data: `0x${string}` }
			);
	return { wallet, calls, sends, state: () => ({ allowance, usdc, eth }) };
}

const send = (amt: string, coin: Coin, w: Eip1193, dc = DC, vault = VAULT) =>
	sendMagiDepositFromBrowserWallet(new CoinAmount(amt, coin), dc, vault, HIVE, w);

describe('sendMagiDepositFromBrowserWallet', () => {
	beforeEach(() => Object.assign(depositTiming, { receiptPollMs: 1, allowanceReadGapMs: 1 }));

	it('ETH: picker, chain switch, checks, then one deposit(recipient) with the value', async () => {
		const f = fakeWallet({ chainId: '0xaa36a7' });
		const hash = await send('0.005', Coin.eth, f.wallet);
		expect(hash).toBe('0x' + '1'.padStart(64, 'a'));
		expect(f.calls.map((c) => c.method).slice(0, 9)).toEqual([
			'wallet_requestPermissions',
			'eth_requestAccounts',
			'eth_chainId',
			'wallet_switchEthereumChain',
			'eth_chainId',
			'eth_getCode',
			'eth_getBalance',
			'eth_estimateGas',
			'eth_gasPrice'
		]);
		expect(f.calls[3].params).toEqual([{ chainId: '0x' + ETH_CHAIN_ID.toString(16) }]);
		const [tx] = f.sends();
		expect(f.sends()).toHaveLength(1);
		expect(getAddress(tx.from)).toBe(getAddress(FROM));
		expect(tx.to).toBe(getAddress(DC));
		expect(BigInt(tx.value)).toBe(5_000_000_000_000_000n);
		expect(decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: tx.data }).args).toEqual([HIVE]);
	});

	it('USDC: approve exactly the amount, re-read the cap, simulate, then depositToken', async () => {
		const f = fakeWallet({});
		await send('5', Coin.usdc, f.wallet);
		const [a, d] = f.sends();
		expect(a.to).toBe(getAddress(USDC_TOKEN_ADDRESS));
		expect(decodeFunctionData({ abi: erc20Abi, data: a.data }).args).toEqual([
			getAddress(DC),
			5_000_000n
		]);
		expect(decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: d.data }).args).toEqual([
			getAddress(USDC_TOKEN_ADDRESS),
			5_000_000n,
			HIVE
		]);
		expect(BigInt(a.value) + BigInt(d.value)).toBe(0n);
		expect(f.state().allowance).toBe(0n);
	});

	it('only ever calls USDC.approve(depositContract, amount), depositToken or deposit: nothing else', async () => {
		for (const [amt, coin] of [
			['0.01', Coin.eth],
			['3', Coin.usdc]
		] as const) {
			const f = fakeWallet({});
			await send(amt, coin, f.wallet);
			for (const tx of f.sends()) {
				if (tx.to === getAddress(USDC_TOKEN_ADDRESS)) {
					const d = decodeFunctionData({ abi: erc20Abi, data: tx.data });
					expect(d.functionName).toBe('approve');
					expect(d.args[0]).toBe(getAddress(DC));
					expect(BigInt(tx.value)).toBe(0n);
				} else {
					expect(tx.to).toBe(getAddress(DC));
					const d = decodeFunctionData({ abi: MAGI_DEPOSIT_ABI, data: tx.data });
					expect(['deposit', 'depositToken']).toContain(d.functionName);
				}
			}
		}
	});

	it('a deposit contract that is not the MagiDeposit for the vault: refused before the wallet opens', async () => {
		const f = fakeWallet({});
		await expect(
			send('0.005', Coin.eth, f.wallet, '0x1111111111111111111111111111111111111111')
		).rejects.toThrow(/is not the bridge's MagiDeposit for its vault/);
		expect(f.calls).toEqual([]);
	});

	it('a deposit contract with no code (not deployed yet after a rotation): nothing is sent', async () => {
		for (const code of ['0x', ''])
			for (const coin of [Coin.eth, Coin.usdc]) {
				const f = fakeWallet({ code });
				await expect(send('5', coin, f.wallet)).rejects.toThrow(/not deployed yet/);
				expect(f.sends()).toEqual([]);
			}
	});

	it('the picker: the chosen account sends (owner 11-20: account 6, not 5)', async () => {
		const f = fakeWallet({ accounts: [FROM, SIX], pick: SIX, eth: { [SIX]: 10n ** 18n } });
		await send('0.005', Coin.eth, f.wallet);
		expect(getAddress(f.sends()[0].from)).toBe(getAddress(SIX));
	});

	it('the picker: a refusal stops, a pending request says so, any other error falls back', async () => {
		const r = fakeWallet({ picker: 'reject' });
		await expect(send('0.005', Coin.eth, r.wallet)).rejects.toThrow('User rejected the request.');
		expect(r.calls.map((c) => c.method)).toEqual(['wallet_requestPermissions']);
		const p = fakeWallet({ picker: 'pending' });
		await expect(send('0.005', Coin.eth, p.wallet)).rejects.toThrow(
			/already waiting in your wallet/
		);
		for (const picker of ['unsupported', 'odd'] as const) {
			const f = fakeWallet({ picker });
			await send('0.005', Coin.eth, f.wallet);
			expect(f.sends()).toHaveLength(1);
		}
	});

	it('a wallet that stays on the wrong chain: nothing is sent', async () => {
		const f = fakeWallet({ chainId: '0x2105', switchChain: 'ignore' });
		await expect(send('0.005', Coin.eth, f.wallet)).rejects.toThrow(/not on Ethereum/);
		expect(f.sends()).toEqual([]);
		const r = fakeWallet({ chainId: '0x2105', switchChain: 'reject' });
		await expect(send('0.005', Coin.eth, r.wallet)).rejects.toThrow('User rejected the request.');
		expect(r.sends()).toEqual([]);
	});

	it('less than the amount: nothing is signed (owner 11-20: 0.128 USDC for a 1 USDC deposit)', async () => {
		const u = fakeWallet({ usdc: { [FROM]: 128_312n } });
		await expect(send('1', Coin.usdc, u.wallet)).rejects.toThrow(
			`The wallet account ${getAddress(FROM)} holds 0.128312 USDC, less than the 1 USDC to deposit`
		);
		expect(u.sends()).toEqual([]);
		const e = fakeWallet({ eth: { [FROM]: 999_999_999_999_999n } });
		await expect(send('0.001', Coin.eth, e.wallet)).rejects.toThrow(
			/holds 0.000999999999999999 ETH, less than the 0.001 ETH/
		);
		expect(e.sends()).toEqual([]);
	});

	it('not enough ETH for the gas: nothing is signed, not even the USDC approve', async () => {
		// 60k approve + 100k deposit at 30 gwei x 1.2 = 0.00576 ETH; the wallet has 0.005
		const u = fakeWallet({ eth: { [FROM]: 5_000_000_000_000_000n }, gasPrice: 30_000_000_000n });
		await expect(send('5', Coin.usdc, u.wallet)).rejects.toThrow(/the gas needs about 0.00576 ETH/);
		expect(u.sends()).toEqual([]);
		// ETH: the amount fits, the amount plus gas does not
		const e = fakeWallet({ eth: { [FROM]: 5_000_000_000_000_000n } });
		await expect(send('0.005', Coin.eth, e.wallet)).rejects.toThrow(
			/the deposit plus its gas needs about/
		);
		expect(e.sends()).toEqual([]);
	});

	it('a spending cap lowered on the approve screen: the deposit is not sent', async () => {
		const f = fakeWallet({ cap: 2_000_000n });
		await expect(send('5', Coin.usdc, f.wallet)).rejects.toThrow(
			'The spending cap approved in the wallet (2 USDC) is lower than the deposit (5 USDC)'
		);
		expect(f.sends()).toHaveLength(1); // the approve only
	});

	it('an allowance read that lags the approve by a few blocks: the deposit still goes (seen on Sepolia 11-21)', async () => {
		const f = fakeWallet({ allowanceLag: 3 });
		await send('5', Coin.usdc, f.wallet);
		expect(f.sends()).toHaveLength(2);
	});

	it('a deposit simulation that lags the approve on another node: retried, the deposit goes (Sepolia 11-21)', async () => {
		const f = fakeWallet({ allowanceLag: 1, estimateLag: 2 });
		await send('5', Coin.usdc, f.wallet);
		expect(f.sends()).toHaveLength(2);
	});

	it('a deposit that keeps failing to simulate after the approve: not sent', async () => {
		const f = fakeWallet({ estimateLag: 99 });
		await expect(send('5', Coin.usdc, f.wallet)).rejects.toThrow(/would fail on Ethereum/);
		expect(f.sends()).toHaveLength(1);
	});

	it('enough allowance already: only the deposit, simulated first', async () => {
		const f = fakeWallet({ allowance: 5_000_000n });
		await send('5', Coin.usdc, f.wallet);
		expect(f.sends()).toHaveLength(1);
		expect(f.calls.filter((c) => c.method === 'eth_estimateGas')).toHaveLength(1);
	});

	it('a sped-up approve still deposits; a sped-up deposit is reported, not called a failure', async () => {
		const a = fakeWallet({ speedUp: 0 });
		await send('5', Coin.usdc, a.wallet);
		expect(a.sends()).toHaveLength(2);
		const d = fakeWallet({ speedUp: 0 });
		await expect(send('0.005', Coin.eth, d.wallet)).rejects.toThrow(
			/replaced the deposit transaction .* If the replacement went through it is credited as usual/
		);
	});

	it('exactly the amount (and its gas) is enough', async () => {
		const f = fakeWallet({ usdc: { [FROM]: 1_000_000n } });
		await expect(send('1', Coin.usdc, f.wallet)).resolves.toMatch(/^0x/);
	});
});

describe('watchBrowserWallets (EIP-6963, keeps listening)', () => {
	it('reports the wallets found, then a wallet that announces itself late', async () => {
		const target = new EventTarget();
		const g = globalThis as unknown as Record<string, unknown>;
		const saved = {
			add: g.addEventListener,
			remove: g.removeEventListener,
			dispatch: g.dispatchEvent
		};
		g.addEventListener = target.addEventListener.bind(target);
		g.removeEventListener = target.removeEventListener.bind(target);
		g.dispatchEvent = (e: Event) => target.dispatchEvent(e);
		const announce = (rdns: string, name: string) =>
			target.dispatchEvent(
				Object.assign(new Event('eip6963:announceProvider'), {
					detail: { info: { rdns, name }, provider: { request: async () => null } }
				})
			);
		const seen: string[][] = [];
		const stop = watchBrowserWallets((w) => seen.push(w.map((x) => x.name)), 10);
		announce('io.metamask', 'MetaMask');
		await new Promise((r) => setTimeout(r, 30));
		announce('io.rabby', 'Rabby');
		announce('io.metamask', 'MetaMask');
		stop();
		announce('com.late', 'After stop');
		g.addEventListener = saved.add;
		g.removeEventListener = saved.remove;
		g.dispatchEvent = saved.dispatch;
		expect(seen).toEqual([['MetaMask'], ['MetaMask', 'Rabby']]);
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
