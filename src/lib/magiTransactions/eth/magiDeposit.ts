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
	concat,
	encodeAbiParameters,
	encodeFunctionData,
	erc20Abi,
	formatEther,
	formatUnits,
	getAddress,
	getContractAddress,
	parseAbi,
	toHex,
	type Hex
} from 'viem';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { toChainUnits } from '$lib/currency/chainAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { ETH_CHAIN_ID, USDC_TOKEN_ADDRESS } from '$lib/constants';
import { CREATE2_DEPLOYER, MAGI_DEPOSIT_CREATION_CODE } from './magiDepositCode';

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

/**
 * Like discoverBrowserWallets, but keeps listening for the page's lifetime: a
 * wallet whose extension starts late (a cold browser, a slow machine) is added
 * when it announces itself instead of the page saying none is installed.
 * Calls `onChange` after `waitMs` with what was found, then on every new
 * wallet. Returns the function that stops listening.
 */
export function watchBrowserWallets(
	onChange: (wallets: BrowserWallet[]) => void,
	waitMs = 400
): () => void {
	const w = globalThis as unknown as {
		addEventListener?: (t: string, f: (e: Event) => void) => void;
		removeEventListener?: (t: string, f: (e: Event) => void) => void;
		dispatchEvent?: (e: Event) => boolean;
		ethereum?: Eip1193;
	};
	const found = new Map<string, BrowserWallet>();
	let ready = false;
	const report = () => {
		const list = [...found.values()];
		if (list.length === 0 && w.ethereum && typeof w.ethereum.request === 'function')
			list.push({ id: 'window.ethereum', name: 'Browser wallet', provider: w.ethereum });
		onChange(list);
	};
	const onAnnounce = (e: Event) => {
		const d = (
			e as CustomEvent<{
				info?: { uuid?: string; name?: string; icon?: string; rdns?: string };
				provider?: Eip1193;
			}>
		).detail;
		if (!d?.provider || typeof d.provider.request !== 'function') return;
		const id = d.info?.rdns || d.info?.uuid || d.info?.name || `wallet-${found.size}`;
		if (found.has(id)) return;
		found.set(id, {
			id,
			name: d.info?.name || 'Browser wallet',
			icon: d.info?.icon,
			provider: d.provider
		});
		if (ready) report();
	};
	w.addEventListener?.('eip6963:announceProvider', onAnnounce);
	w.dispatchEvent?.(new Event('eip6963:requestProvider'));
	const t = setTimeout(() => {
		ready = true;
		report();
	}, waitMs);
	return () => {
		clearTimeout(t);
		w.removeEventListener?.('eip6963:announceProvider', onAnnounce);
	};
}

/**
 * The MagiDeposit address for `vault`, derived the way the bridge derives it
 * (account-mapping: CREATE2 through the deterministic deployer, salt 0, the
 * vault as constructor argument). Code at this address can only be MagiDeposit.
 */
export function magiDepositAddressFor(vault: string): Hex {
	return getContractAddress({
		opcode: 'CREATE2',
		from: CREATE2_DEPLOYER,
		salt: toHex(0, { size: 32 }),
		bytecode: concat([
			MAGI_DEPOSIT_CREATION_CODE,
			encodeAbiParameters([{ type: 'address' }], [getAddress(vault)])
		])
	});
}

type WalletErr = { code?: number; message?: string };
const codeOf = (err: unknown) => (err as WalletErr)?.code;

/** 4001: the user refused in the wallet. -32002: a request is already waiting there. */
function stopOnRefusal(err: unknown): void {
	const code = codeOf(err);
	if (code === 4001) throw err;
	if (code === -32002)
		throw new Error('A request is already waiting in your wallet: open the wallet and answer it.');
}

/**
 * The account the deposit is sent from, picked by the user in the wallet.
 * eth_requestAccounts alone returns the account the site is already connected
 * to without asking (owner 11-20: MetaMask always used account 5, never
 * account 6 that held the ETH). wallet_requestPermissions opens the wallet's
 * account picker every time (EIP-2255, MetaMask's documented way to let a user
 * choose another account); the wallet then lists the chosen account first.
 * A refusal in the picker stops; any other error (a wallet without the
 * picker answers it in its own way) falls back to the plain connect.
 */
export async function chooseAccount(wallet: Eip1193): Promise<Hex> {
	try {
		await wallet.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
	} catch (err) {
		stopOnRefusal(err);
	}
	let accounts: string[];
	try {
		accounts = (await wallet.request({ method: 'eth_requestAccounts' })) as string[];
	} catch (err) {
		stopOnRefusal(err);
		throw err;
	}
	const from = accounts?.[0];
	if (!from) throw new Error('The wallet shared no account.');
	return getAddress(from);
}

const hexInt = (v: unknown) => BigInt((v as string) || '0x0');

/** Gas a depositToken call takes when it cannot be simulated yet (before the
 *  approve lands). Measured: 65,269 (Sepolia, 11-20), 78,497 (mainnet
 *  estimate, a vault holding no USDC yet). */
const DEPOSIT_TOKEN_GAS_BEFORE_APPROVE = 100_000n;

/** Polling: the receipt every 4 s; the allowance may lag the approve's
 *  receipt (wallet RPCs are load-balanced; seen on Sepolia 11-21), so up to
 *  10 reads 3 s apart. Tests shorten these. */
export const depositTiming = { receiptPollMs: 4000, allowanceReads: 10, allowanceReadGapMs: 3000 };

/**
 * Wait for `hash` to be mined. 'replaced' when the wallet sent another
 * transaction with the same nonce instead (the user sped it up or cancelled
 * it in the wallet): that one has its own hash, so this one never gets a receipt.
 */
async function waitForReceipt(
	wallet: Eip1193,
	from: string,
	hash: Hex,
	timeoutMs = 15 * 60 * 1000
): Promise<'0x1' | '0x0' | 'replaced'> {
	const until = Date.now() + timeoutMs;
	let nonce: bigint | null = null;
	while (Date.now() < until) {
		const rc = (await wallet.request({ method: 'eth_getTransactionReceipt', params: [hash] })) as {
			status?: string;
		} | null;
		if (rc?.status === '0x1' || rc?.status === '0x0') return rc.status;
		if (nonce === null) {
			const tx = (await wallet.request({
				method: 'eth_getTransactionByHash',
				params: [hash]
			})) as { nonce?: string } | null;
			if (tx?.nonce) nonce = hexInt(tx.nonce);
		}
		if (nonce !== null) {
			const mined = hexInt(
				await wallet.request({ method: 'eth_getTransactionCount', params: [from, 'latest'] })
			);
			if (mined > nonce) {
				// One last look: our transaction may have been mined just now.
				const again = (await wallet.request({
					method: 'eth_getTransactionReceipt',
					params: [hash]
				})) as { status?: string } | null;
				if (again?.status === '0x1' || again?.status === '0x0') return again.status;
				return 'replaced';
			}
		}
		await new Promise((r) => setTimeout(r, depositTiming.receiptPollMs));
	}
	throw new Error(
		`No receipt for ${hash} after ${Math.round(timeoutMs / 60000)} minutes; check it on Etherscan.`
	);
}

async function estimate(wallet: Eip1193, from: string, tx: WalletTx): Promise<bigint> {
	try {
		return hexInt(await wallet.request({ method: 'eth_estimateGas', params: [{ from, ...tx }] }));
	} catch (err) {
		const m = (err as WalletErr)?.message || String(err);
		throw new Error(`The deposit would fail on Ethereum (${m}), so nothing was sent.`);
	}
}

/**
 * Deposit from the browser's own Ethereum wallet through the MagiDeposit
 * contract, credited to `recipient` (the account logged in here). It talks to
 * the wallet directly, never through the Reown modal, which would log the user
 * in as the wallet's address. Before anything is signed it checks everything a
 * signature could otherwise be wasted on: the contract is the bridge's
 * MagiDeposit for `vault` and is deployed, the wallet is on Ethereum, the
 * chosen account holds the amount and the ETH for the gas, and each call
 * simulates without reverting. Returns the deposit transaction's hash.
 */
export async function sendMagiDepositFromBrowserWallet(
	amount: CoinAmount<Coin>,
	depositContract: string,
	vault: string,
	recipient: string,
	wallet: Eip1193
): Promise<Hex> {
	const contract = getAddress(depositContract);
	// Only ever the MagiDeposit the bridge derives for its own vault: any other
	// address (a wrong or tampered answer) is refused before the wallet opens.
	if (magiDepositAddressFor(vault) !== contract)
		throw new Error(
			`The deposit contract ${contract} is not the bridge's MagiDeposit for its vault ${getAddress(vault)}, so nothing was sent.`
		);
	const from = await chooseAccount(wallet);
	const chainHex = toHex(ETH_CHAIN_ID);
	const onChain = async () =>
		((await wallet.request({ method: 'eth_chainId' })) as string).toLowerCase() === chainHex;
	if (!(await onChain())) {
		await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] });
		if (!(await onChain()))
			throw new Error(
				`The wallet is not on ${ETH_CHAIN_ID === 1 ? 'Ethereum' : 'Sepolia'}; switch it there and try again.`
			);
	}
	// depositAddress() names the active vault's MagiDeposit whether or not it is
	// deployed (CREATE2; after a key rotation nobody has deployed the new one
	// yet). A deposit() call to an address with no code succeeds on Ethereum,
	// emits no Deposit log and is never credited: the ETH would be lost. The bot
	// alarms on the same thing (I-28, health.go checkDepositContracts).
	const code = (await wallet.request({ method: 'eth_getCode', params: [contract, 'latest'] })) as
		| string
		| null;
	if (!code || code === '0x')
		throw new Error(
			"The bridge's deposit contract for its current vault is not deployed yet, so nothing was sent. Try again later."
		);
	const want = BigInt(toChainUnits(amount));
	const isUsdc = amount.coin.value === Coin.usdc.value;
	const usdc = getAddress(USDC_TOKEN_ADDRESS);
	const readUsdc = async (data: Hex) =>
		hexInt(await wallet.request({ method: 'eth_call', params: [{ to: usdc, data }, 'latest'] }));
	const eth = hexInt(await wallet.request({ method: 'eth_getBalance', params: [from, 'latest'] }));
	// The wallet must hold the amount before anything is signed: a USDC deposit
	// it cannot cover reverts (MagiDeposit TokenTransferFailed) after the user
	// already paid for the approve, and the wallet can only price the failing
	// call with a fallback gas limit (owner 11-20: "$11 ... $79").
	const held = isUsdc
		? await readUsdc(encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [from] }))
		: eth;
	if (held < want) {
		const d = amount.coin.decimalPlaces;
		throw new Error(
			`The wallet account ${from} holds ${formatUnits(held, d)} ${amount.coin.label}, less than the ${formatUnits(want, d)} ${amount.coin.label} to deposit, so nothing was sent. Pick an account that holds it.`
		);
	}
	const readAllowance = () =>
		readUsdc(
			encodeFunctionData({ abi: erc20Abi, functionName: 'allowance', args: [from, contract] })
		);
	const txs = magiDepositTxs(amount, contract, recipient, isUsdc ? await readAllowance() : 0n);
	// Gas for every call before the first signature: a USDC deposit whose
	// approve uses up the last ETH could never send the deposit itself.
	// Simulating each call (eth_estimateGas) also catches any revert up front.
	let gas = 0n;
	for (const tx of txs) {
		const isDepositAfterApprove = txs.length === 2 && tx === txs[1];
		gas += isDepositAfterApprove
			? DEPOSIT_TOKEN_GAS_BEFORE_APPROVE
			: await estimate(wallet, from, tx);
	}
	const gasPrice = hexInt(await wallet.request({ method: 'eth_gasPrice' }));
	const fee = (gas * gasPrice * 12n) / 10n;
	const needEth = fee + (isUsdc ? 0n : want);
	if (eth < needEth)
		throw new Error(
			`The wallet account ${from} holds ${formatEther(eth)} ETH; ${isUsdc ? 'the gas' : 'the deposit plus its gas'} needs about ${formatEther(needEth)} ETH, so nothing was sent.`
		);
	let last: Hex = '0x';
	for (const tx of txs) {
		const isDeposit = tx === txs[txs.length - 1];
		if (isDeposit && txs.length === 2) {
			// The wallet lets the user edit the approve's spending cap: a lower cap
			// would make the deposit revert. Re-read it, then simulate the deposit.
			// The approve's receipt can come from a node a block ahead of the one
			// answering the next read (wallets load-balance their RPC): give the
			// allowance a few reads to show the approve before judging the cap.
			let cap = await readAllowance();
			for (let i = 0; cap < want && i < depositTiming.allowanceReads; i++) {
				await new Promise((r) => setTimeout(r, depositTiming.allowanceReadGapMs));
				cap = await readAllowance();
			}
			if (cap < want)
				throw new Error(
					`The spending cap approved in the wallet (${formatUnits(cap, 6)} USDC) is lower than the deposit (${formatUnits(want, 6)} USDC), so the deposit was not sent. Deposit at most ${formatUnits(cap, 6)} USDC, or start again to approve ${formatUnits(want, 6)}.`
				);
			// The simulation can hit a node that has not seen the approve yet
			// either (seen on Sepolia 11-21: the allowance read passed, the
			// estimate on the next node reverted): retry it the same way.
			for (let i = 0; ; i++) {
				try {
					await estimate(wallet, from, tx);
					break;
				} catch (err) {
					if (i >= depositTiming.allowanceReads) throw err;
					await new Promise((r) => setTimeout(r, depositTiming.allowanceReadGapMs));
				}
			}
		}
		last = (await wallet.request({
			method: 'eth_sendTransaction',
			params: [{ from, ...tx }]
		})) as Hex;
		const r = await waitForReceipt(wallet, from, last);
		if (r === '0x0') throw new Error(`The transaction reverted (${last}).`);
		if (r === 'replaced') {
			// A sped-up approve: the allowance check before the deposit decides.
			if (!isDeposit) continue;
			throw new Error(
				`The wallet replaced the deposit transaction ${last} (sped up or cancelled in the wallet). If the replacement went through it is credited as usual; check the wallet's activity.`
			);
		}
	}
	return last;
}
