/**
 * Send BTC to the account's deposit address from a Bitcoin wallet installed in
 * the browser (Leather, Xverse, Unisat), for a login that is not that wallet
 * (a Hive account or an Ethereum wallet). The ETH deposit has the same for
 * Ethereum wallets (magiDeposit.ts).
 *
 * No Reown: the wallet is called through the object it injects into the page,
 * so it never becomes the login, and a Hive or Ethereum-wallet login is left
 * exactly as it was (the clash sideWallet.ts guards against on the ETH side
 * cannot happen here). This module must not import $lib/auth/reown.
 *
 * Call shapes, from each wallet's docs (11-21):
 * - Leather: window.LeatherProvider.request('getAddresses') then
 *   request('sendTransfer', { recipients: [{ address, amount: '<sats>' }],
 *   network }) -> { result: { txid } }; the amount is a string of sats.
 * - Xverse: window.XverseProviders.BitcoinProvider.request('getAccounts',
 *   { purposes: ['payment'] }) then request('sendTransfer', { recipients:
 *   [{ address, amount: <sats> }] }) -> { result: { txid } }; a number.
 * - Unisat: window.unisat.requestAccounts() then sendBitcoin(address, sats)
 *   -> txid.
 * A rejection is { error: { code, message } } (4001 / USER_REJECTION = the
 * user said no), either returned or thrown.
 */
import { formatWalletError } from './walletError';

export type BtcBrowserWalletId = 'leather' | 'xverse' | 'unisat';
export type BtcBrowserWallet = { id: BtcBrowserWalletId; name: string };

type RpcProvider = { request: (method: string, params?: unknown) => Promise<unknown> };
type UnisatProvider = {
	requestAccounts: () => Promise<string[]>;
	sendBitcoin: (address: string, sats: number) => Promise<string>;
	/** { enum: 'BITCOIN_MAINNET' | 'BITCOIN_TESTNET' | 'FRACTAL_BITCOIN_MAINNET' | ... } */
	getChain?: () => Promise<{ enum?: string }>;
	/** 'livenet' | 'testnet' (older API) */
	getNetwork?: () => Promise<string>;
};

const NAMES: Record<BtcBrowserWalletId, string> = {
	leather: 'Leather',
	xverse: 'Xverse',
	unisat: 'Unisat'
};

/** The smallest deposit the BTC bridge credits (btc-mapping-contract MinDepositSats). */
export const MIN_BTC_DEPOSIT_SATS = 1000;

function provider(
	id: BtcBrowserWalletId,
	w: Record<string, unknown>
): RpcProvider | UnisatProvider | null {
	if (id === 'leather') {
		const p = w.LeatherProvider as RpcProvider | undefined;
		return p && typeof p.request === 'function' ? p : null;
	}
	if (id === 'xverse') {
		const p = (w.XverseProviders as { BitcoinProvider?: RpcProvider } | undefined)
			?.BitcoinProvider;
		return p && typeof p.request === 'function' ? p : null;
	}
	const u = w.unisat as UnisatProvider | undefined;
	return u && typeof u.sendBitcoin === 'function' && typeof u.requestAccounts === 'function'
		? u
		: null;
}

/** The Bitcoin wallets installed in this browser, in a fixed order. */
export function detectBtcBrowserWallets(
	w: Record<string, unknown> = globalThis as unknown as Record<string, unknown>
): BtcBrowserWallet[] {
	return (['leather', 'xverse', 'unisat'] as const)
		.filter((id) => provider(id, w) != null)
		.map((id) => ({ id, name: NAMES[id] }));
}

export function btcAddressNetwork(address: string): 'mainnet' | 'testnet' | null {
	if (/^(bc1[qp][0-9a-z]{38,58}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(address)) return 'mainnet';
	if (/^(tb1[qp][0-9a-z]{38,58}|bcrt1[0-9a-z]+|[mn2][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(address))
		return 'testnet';
	return null;
}

/** A JSON-RPC style reply as either wallet returns it: the result, or a throw. */
function unwrap(res: unknown): Record<string, unknown> | unknown[] {
	const r = (res ?? {}) as Record<string, unknown>;
	if (r.error || r.status === 'error') throw r.error ?? r;
	const out = 'result' in r ? r.result : r;
	return (out ?? {}) as Record<string, unknown> | unknown[];
}

function isRejection(err: unknown): boolean {
	const e = (err ?? {}) as Record<string, unknown>;
	const code = e.code ?? (e.error as Record<string, unknown> | undefined)?.code;
	return code === 4001 || code === -32000 || /reject|denied|cancel/i.test(formatWalletError(err));
}

async function paymentAddress(id: BtcBrowserWalletId, p: RpcProvider | UnisatProvider) {
	if (id === 'unisat') {
		const accounts = await (p as UnisatProvider).requestAccounts();
		return String(accounts?.[0] ?? '');
	}
	const rpc = p as RpcProvider;
	if (id === 'leather') {
		const r = unwrap(await rpc.request('getAddresses')) as { addresses?: unknown[] };
		const list = (r.addresses ?? []) as Array<{ address?: string; type?: string; symbol?: string }>;
		const pay =
			list.find((a) => a.symbol === 'BTC' && a.type === 'p2wpkh') ??
			list.find((a) => a.symbol === 'BTC' || a.type === 'p2wpkh');
		return String(pay?.address ?? '');
	}
	const r = unwrap(await rpc.request('getAccounts', { purposes: ['payment'] }));
	const list = (Array.isArray(r) ? r : ((r as { addresses?: unknown[] }).addresses ?? [])) as Array<{
		address?: string;
		purpose?: string;
	}>;
	const pay = list.find((a) => a.purpose === 'payment') ?? list[0];
	return String(pay?.address ?? '');
}

/**
 * The chain the wallet says it is on, when it can say (Unisat getChain /
 * getNetwork, Xverse wallet_getNetwork); null when it does not answer, and
 * the address check above stands alone.
 */
async function walletChain(
	id: BtcBrowserWalletId,
	p: RpcProvider | UnisatProvider
): Promise<'mainnet' | 'testnet' | 'other' | null> {
	try {
		if (id === 'unisat') {
			const u = p as UnisatProvider;
			if (typeof u.getChain === 'function') {
				const e = String((await u.getChain())?.enum ?? '');
				if (!e) return null;
				if (e === 'BITCOIN_MAINNET') return 'mainnet';
				if (/TESTNET|SIGNET|REGTEST/.test(e)) return 'testnet';
				if (/FRACTAL/.test(e)) return 'other';
				// A name not known here: the address check stands alone, rather
				// than refuse a wallet that is in fact on mainnet.
				return null;
			}
			if (typeof u.getNetwork === 'function') {
				const n = await u.getNetwork();
				return n === 'livenet' ? 'mainnet' : n ? 'testnet' : null;
			}
			return null;
		}
		if (id === 'xverse') {
			const r = unwrap(await (p as RpcProvider).request('wallet_getNetwork')) as {
				bitcoin?: { name?: string };
			};
			const n = String(r?.bitcoin?.name ?? '').toLowerCase();
			if (!n) return null;
			if (n === 'mainnet') return 'mainnet';
			if (/testnet|signet|regtest/.test(n)) return 'testnet';
			return null; // unknown name: the address check stands alone
		}
		return null; // Leather: the sendTransfer `network` field pins the chain
	} catch {
		return null;
	}
}

/**
 * Sends `amountSats` to `recipient` from the chosen wallet and returns the
 * Bitcoin txid. Refuses before the wallet is asked to sign when the amount is
 * under the bridge minimum, the recipient is not an address of `network`, or
 * the wallet's own payment address is on another network. One sendTransfer
 * call, never retried: a retry after a broadcast would be a second payment.
 */
export async function sendBtcFromBrowserWallet(
	args: {
		walletId: BtcBrowserWalletId;
		recipient: string;
		amountSats: number;
		network: 'mainnet' | 'testnet';
	},
	w: Record<string, unknown> = globalThis as unknown as Record<string, unknown>
): Promise<{ txid: string; from: string }> {
	const { walletId, recipient, amountSats, network } = args;
	const name = NAMES[walletId];
	const p = provider(walletId, w);
	if (!p) throw new Error(`${name} is not installed in this browser.`);
	if (!Number.isSafeInteger(amountSats) || amountSats < MIN_BTC_DEPOSIT_SATS) {
		throw new Error(
			`Send at least ${MIN_BTC_DEPOSIT_SATS} sats (${MIN_BTC_DEPOSIT_SATS / 1e8} BTC): the bridge does not credit less.`
		);
	}
	if (btcAddressNetwork(recipient) !== network) {
		throw new Error('The deposit address is not a Bitcoin ' + network + ' address.');
	}

	let from: string;
	try {
		from = await paymentAddress(walletId, p);
	} catch (err) {
		throw new Error(
			isRejection(err)
				? `You declined the connection in ${name}.`
				: `${name} did not connect: ${formatWalletError(err)}`
		);
	}
	if (!from) throw new Error(`${name} gave no Bitcoin payment address.`);
	const fromNet = btcAddressNetwork(from);
	if (fromNet !== network) {
		throw new Error(
			fromNet
				? `${name} is on Bitcoin ${fromNet}, the deposit address is on ${network}: switch ${name} to ${network} first.`
				: `${name}'s address (${from}) is not a Bitcoin ${network} address.`
		);
	}
	// An address cannot tell every chain apart (Fractal Bitcoin and Bitcoin
	// both use bc1; testnet4 and signet look like testnet): ask the wallet.
	const chain = await walletChain(walletId, p);
	if (chain && chain !== network) {
		throw new Error(
			`${name} is set to ${chain === 'other' ? 'another chain' : `Bitcoin ${chain}`}, not Bitcoin ${network}: switch it first. Nothing was sent.`
		);
	}

	let txid: unknown;
	try {
		if (walletId === 'unisat') {
			txid = await (p as UnisatProvider).sendBitcoin(recipient, amountSats);
		} else {
			const amount = walletId === 'leather' ? String(amountSats) : amountSats;
			const params: Record<string, unknown> = { recipients: [{ address: recipient, amount }] };
			if (walletId === 'leather') params.network = network;
			const r = unwrap(await (p as RpcProvider).request('sendTransfer', params)) as {
				txid?: unknown;
			};
			txid = r.txid;
		}
	} catch (err) {
		throw new Error(
			isRejection(err)
				? `You rejected the payment in ${name}. Nothing was sent.`
				: `${name} could not send: ${formatWalletError(err)}`
		);
	}
	if (typeof txid !== 'string' || !/^[0-9a-f]{64}$/i.test(txid)) {
		// It may still have gone out: say so instead of inviting a second send.
		throw new Error(
			`${name} returned no transaction id. Check ${name}'s activity before sending again.`
		);
	}
	return { txid, from };
}
