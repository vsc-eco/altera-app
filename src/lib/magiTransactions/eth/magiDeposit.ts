/**
 * Deposits through the MagiDeposit contract (account-mapping
 * l1-deposit/MagiDeposit.sol), sent by a wallet installed in the browser.
 * deposit(recipient) and depositToken(token, amount, recipient) name the Magi
 * account to credit (RP-7), so any login (Hive included) can deposit ETH and
 * USDC: the page lists the installed wallets (EIP-6963) and the chosen one
 * signs. It talks to the wallet directly, never through the Reown modal, which
 * would log the user in as the wallet's address.
 */
import {
	encodeFunctionData,
	erc20Abi,
	formatUnits,
	getAddress,
	parseAbi,
	toHex,
	type Hex
} from 'viem';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { toChainUnits } from '$lib/currency/chainAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { ETH_CHAIN_ID, USDC_TOKEN_ADDRESS } from '$lib/constants';

export const MAGI_DEPOSIT_ABI = parseAbi([
	'function deposit(string recipient) payable',
	'function depositToken(address token, uint256 amount, string recipient)'
]);

/** One Ethereum transaction a browser wallet is asked to send. */
export type WalletTx = { to: Hex; value: Hex; data: Hex };

/**
 * The transactions that deposit `amount` through the MagiDeposit contract to
 * `recipient` (e.g. "hive:alice"): ETH is one deposit(recipient) call carrying
 * the value; USDC is an approve of the contract (only when the wallet's
 * allowance is short) and then depositToken(USDC, amount, recipient).
 */
export function magiDepositTxs(
	amount: CoinAmount<Coin>,
	depositContract: string,
	recipient: string,
	allowance: bigint = 0n
): WalletTx[] {
	const to = getAddress(depositContract);
	const value = BigInt(toChainUnits(amount));
	if (amount.coin.value === Coin.eth.value) {
		return [
			{
				to,
				value: toHex(value),
				data: encodeFunctionData({
					abi: MAGI_DEPOSIT_ABI,
					functionName: 'deposit',
					args: [recipient]
				})
			}
		];
	}
	if (amount.coin.value === Coin.usdc.value) {
		const usdc = getAddress(USDC_TOKEN_ADDRESS);
		const txs: WalletTx[] = [];
		if (allowance < value) {
			txs.push({
				to: usdc,
				value: '0x0',
				data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [to, value] })
			});
		}
		txs.push({
			to,
			value: '0x0',
			data: encodeFunctionData({
				abi: MAGI_DEPOSIT_ABI,
				functionName: 'depositToken',
				args: [usdc, value, recipient]
			})
		});
		return txs;
	}
	throw new Error(`${amount.coin.label} cannot be deposited through the EVM bridge`);
}

/** An EIP-1193 provider (window.ethereum: MetaMask, Rabby, a hardware wallet's extension). */
export type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

/** A wallet installed in this browser (EIP-6963 announcement, or window.ethereum). */
export type BrowserWallet = { id: string; name: string; icon?: string; provider: Eip1193 };

/**
 * The Ethereum wallets installed in this browser, found the EIP-6963 way (each
 * extension announces itself: MetaMask, Rabby, Coinbase Wallet, a hardware
 * wallet's bridge...), so the user picks one; window.ethereum only when nothing
 * announces itself.
 */
export async function discoverBrowserWallets(waitMs = 400): Promise<BrowserWallet[]> {
	const w = globalThis as unknown as {
		addEventListener?: (t: string, f: (e: Event) => void) => void;
		removeEventListener?: (t: string, f: (e: Event) => void) => void;
		dispatchEvent?: (e: Event) => boolean;
		ethereum?: Eip1193;
	};
	const found = new Map<string, BrowserWallet>();
	const onAnnounce = (e: Event) => {
		const d = (
			e as CustomEvent<{
				info?: { uuid?: string; name?: string; icon?: string; rdns?: string };
				provider?: Eip1193;
			}>
		).detail;
		if (!d?.provider || typeof d.provider.request !== 'function') return;
		const id = d.info?.rdns || d.info?.uuid || d.info?.name || `wallet-${found.size}`;
		if (!found.has(id))
			found.set(id, {
				id,
				name: d.info?.name || 'Browser wallet',
				icon: d.info?.icon,
				provider: d.provider
			});
	};
	if (w.addEventListener && w.dispatchEvent) {
		w.addEventListener('eip6963:announceProvider', onAnnounce);
		w.dispatchEvent(new Event('eip6963:requestProvider'));
		await new Promise((r) => setTimeout(r, waitMs));
		w.removeEventListener?.('eip6963:announceProvider', onAnnounce);
	}
	if (found.size === 0 && w.ethereum && typeof w.ethereum.request === 'function') {
		found.set('window.ethereum', {
			id: 'window.ethereum',
			name: 'Browser wallet',
			provider: w.ethereum
		});
	}
	return [...found.values()];
}

async function waitForReceipt(
	wallet: Eip1193,
	hash: Hex,
	timeoutMs = 15 * 60 * 1000
): Promise<'0x1' | '0x0'> {
	const until = Date.now() + timeoutMs;
	while (Date.now() < until) {
		const rc = (await wallet.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as {
			status?: string;
		} | null;
		if (rc?.status === '0x1' || rc?.status === '0x0') return rc.status;
		await new Promise((r) => setTimeout(r, 4000));
	}
	throw new Error(
		`No receipt for ${hash} after ${Math.round(timeoutMs / 60000)} minutes; check it on Etherscan.`
	);
}

/**
 * Deposit from the browser's own Ethereum wallet through the MagiDeposit
 * contract, credited to `recipient` (the account the user is logged in with,
 * Hive or Ethereum). It talks to window.ethereum directly and never through the
 * Reown modal, which would log the user in as the wallet's address. Returns the
 * deposit transaction's hash once it is mined.
 */
export async function sendMagiDepositFromBrowserWallet(
	amount: CoinAmount<Coin>,
	depositContract: string,
	recipient: string,
	wallet: Eip1193
): Promise<Hex> {
	const accounts = (await wallet.request({ method: 'eth_requestAccounts' })) as string[];
	const from = accounts?.[0];
	if (!from) throw new Error('The wallet shared no account.');
	const chainHex = toHex(ETH_CHAIN_ID);
	if (((await wallet.request({ method: 'eth_chainId' })) as string).toLowerCase() !== chainHex) {
		await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] });
	}
	// depositAddress() names the active vault's MagiDeposit whether or not it is
	// deployed (CREATE2; after a key rotation nobody has deployed the new one
	// yet). A deposit() call to an address with no code succeeds on Ethereum,
	// emits no Deposit log and is never credited: the ETH would be lost. The bot
	// alarms on the same thing (I-28, health.go checkDepositContracts).
	const code = (await wallet.request({
		method: 'eth_getCode',
		params: [getAddress(depositContract), 'latest']
	})) as string | null;
	if (!code || code === '0x')
		throw new Error(
			"The bridge's deposit contract for its current vault is not deployed yet, so nothing was sent. Try again later."
		);
	// The wallet must hold the amount before anything is signed: a USDC deposit
	// it cannot cover reverts (MagiDeposit TokenTransferFailed) after the user
	// already paid for the approve, and the wallet can only price the failing
	// call with a fallback gas limit (owner 11-20: "$11 ... $79").
	const want = BigInt(toChainUnits(amount));
	const isUsdc = amount.coin.value === Coin.usdc.value;
	const held = BigInt(
		isUsdc
			? ((await wallet.request({
					method: 'eth_call',
					params: [
						{
							to: getAddress(USDC_TOKEN_ADDRESS),
							data: encodeFunctionData({
								abi: erc20Abi,
								functionName: 'balanceOf',
								args: [getAddress(from)]
							})
						},
						'latest'
					]
				})) as string)
			: ((await wallet.request({ method: 'eth_getBalance', params: [from, 'latest'] })) as string)
	);
	if (held < want) {
		const d = amount.coin.decimalPlaces;
		throw new Error(
			`This wallet holds ${formatUnits(held, d)} ${amount.coin.label}, less than the ${formatUnits(want, d)} ${amount.coin.label} to deposit, so nothing was sent.` +
				(isUsdc ? '' : ' It also needs a little more ETH for the gas.')
		);
	}
	let allowance = 0n;
	if (isUsdc) {
		const data = encodeFunctionData({
			abi: erc20Abi,
			functionName: 'allowance',
			args: [getAddress(from), getAddress(depositContract)]
		});
		allowance = BigInt(
			(await wallet.request({
				method: 'eth_call',
				params: [{ to: getAddress(USDC_TOKEN_ADDRESS), data }, 'latest']
			})) as string
		);
	}
	let last: Hex = '0x';
	for (const tx of magiDepositTxs(amount, depositContract, recipient, allowance)) {
		last = (await wallet.request({
			method: 'eth_sendTransaction',
			params: [{ from, ...tx }]
		})) as Hex;
		if ((await waitForReceipt(wallet, last)) !== '0x1')
			throw new Error(`The transaction reverted (${last}).`);
	}
	return last;
}
