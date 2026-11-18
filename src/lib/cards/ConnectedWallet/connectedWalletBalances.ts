import { getHiveAccounts } from '$lib/auth/hive/getHiveAccounts';
import { isBtcTestnetAddress } from '$lib/stores/currentBalance';
import { spendableSats, type MempoolAddressStats } from '$lib/stores/btcSpendable';
import type { Account } from '$lib/auth/hive/accountTypes';
import type { Auth } from '$lib/auth/store';

export type WalletBalance = {
	symbol: string;
	amount: number;
	icon?: string;
	/** Optional qualifier shown next to the symbol, e.g. "savings". */
	sub?: string;
};

/** "1.234 HIVE" → 1.234 */
function parseHiveAmount(s: string | undefined): number {
	if (!s) return 0;
	const n = Number.parseFloat(String(s).split(' ')[0]);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Hive L1 balances for a Keychain/Hive account — liquid HIVE + HBD and their
 * savings balances. Deliberately NOT hive-engine tokens (those are a separate
 * layer the user didn't ask for).
 */
export async function fetchHiveL1Balances(username: string): Promise<WalletBalance[]> {
	const res = (await getHiveAccounts([username])) as { result?: Account[] } | undefined;
	const acc = res?.result?.[0];
	if (!acc) return [];
	const hive = parseHiveAmount(acc.balance);
	const hbd = parseHiveAmount(acc.hbd_balance);
	const hiveSavings = parseHiveAmount(acc.savings_balance);
	const hbdSavings = parseHiveAmount(acc.savings_hbd_balance);
	const out: WalletBalance[] = [
		{ symbol: 'HIVE', amount: hive, icon: '/hive/hive.svg' },
		{ symbol: 'HBD', amount: hbd, icon: '/hive/hbd.svg' }
	];
	if (hiveSavings > 0)
		out.push({ symbol: 'HIVE', amount: hiveSavings, icon: '/hive/hive.svg', sub: 'savings' });
	if (hbdSavings > 0)
		out.push({ symbol: 'HBD', amount: hbdSavings, icon: '/hive/hbd.svg', sub: 'savings' });
	return out;
}

/**
 * Native EVM balance of the connected address via the reown/wagmi config,
 * pinned to `chainId` (the DID's chain — Ethereum L1 mainnet for Altera) so the
 * figure always matches the eip155 identity, not whatever chain the wallet is
 * currently switched to. Funds on L2s (Arbitrum, etc.) are out of scope.
 */
export async function fetchEvmBalances(address: string, chainId = 1): Promise<WalletBalance[]> {
	// initModal() ensures wagmiConfig exists (it's created lazily; a reload may
	// not have re-created it yet). Safe to call repeatedly.
	const { initModal, wagmiConfig } = await import('$lib/auth/reown');
	initModal();
	// Errors propagate: a caller that cannot tell "the RPC failed" from "the
	// wallet is empty" renders a zero, and a zero balance is the one thing a
	// user will act on without checking.
	if (!wagmiConfig) throw new Error('Wallet connection is not initialised');
	const { getBalance } = await import('@wagmi/core');
	const bal = (await getBalance(wagmiConfig, {
		address: address as `0x${string}`,
		chainId
	})) as {
		value: bigint;
		decimals: number;
		symbol?: string;
	};
	const amount = Number(bal.value) / 10 ** bal.decimals;
	const symbol = bal.symbol || 'ETH';
	return [{ symbol, amount, icon: symbol === 'ETH' ? '/eth/eth.svg' : undefined }];
}

/**
 * BTC balance of the connected address via mempool.space's public API.
 *
 * The headline figure is `spendableSats` — the SAME number the swap card's
 * Max uses. This used to add unconfirmed incoming coins to it, so the two
 * screens quoted different balances for one wallet and the portfolio's was
 * the one you could not spend. Incoming coins are not lost from view: they
 * come back as a second `pending` row, the way savings do for Hive.
 */
export async function fetchBtcBalance(address: string): Promise<WalletBalance[]> {
	const base = isBtcTestnetAddress(address)
		? 'https://mempool.space/testnet/api'
		: 'https://mempool.space/api';
	const res = await fetch(`${base}/address/${address}`);
	if (!res.ok) throw new Error(`mempool.space returned ${res.status}`);
	const stats = (await res.json()) as MempoolAddressStats;
	const spendable = spendableSats(stats);
	const mempoolIn =
		(stats.mempool_stats?.funded_txo_sum ?? 0) - (stats.mempool_stats?.spent_txo_sum ?? 0);
	const out: WalletBalance[] = [{ symbol: 'BTC', amount: spendable / 1e8, icon: '/btc/btc.svg' }];
	if (mempoolIn > 0)
		out.push({ symbol: 'BTC', amount: mempoolIn / 1e8, icon: '/btc/btc.svg', sub: 'pending' });
	return out;
}

/** Dispatch to the right chain based on the auth provider / DID. */
export async function fetchConnectedWalletBalances(auth: Auth): Promise<WalletBalance[]> {
	const v = auth.value;
	if (!v) return [];
	if (v.provider === 'aioha' && v.username) return fetchHiveL1Balances(v.username);
	if (v.provider === 'reown') {
		if (v.did?.startsWith('did:pkh:bip122:')) return fetchBtcBalance(v.address);
		if (v.did?.startsWith('did:pkh:eip155:')) {
			// did:pkh:eip155:<chainId>:<address> — read the balance on that chain.
			const chainId = Number(v.did.split(':')[3]) || 1;
			return fetchEvmBalances(v.address, chainId);
		}
	}
	return [];
}

/**
 * How a connected wallet is named on screen: which chain it is, and which
 * account on it. The address is middle-truncated — the first and last
 * characters are what a reader checks against their wallet, and the middle
 * is what makes a 42-character string unreadable.
 */
export function connectedWalletLabel(auth: Auth): { chain: string; account: string } | undefined {
	const v = auth.value;
	if (!v) return undefined;
	if (v.provider === 'aioha' && v.username) return { chain: 'Hive', account: `@${v.username}` };
	if (v.did?.startsWith('did:pkh:bip122:'))
		return { chain: 'Bitcoin', account: truncateAddress(v.address) };
	if (v.did?.startsWith('did:pkh:eip155:'))
		return { chain: 'Ethereum', account: truncateAddress(v.address) };
	return undefined;
}

/** `bc1qar0srrr7x...gdjkmdfnjd` — enough of both ends to check by eye. */
export function truncateAddress(address: string, lead = 8, tail = 6): string {
	if (!address) return '';
	if (address.length <= lead + tail + 1) return address;
	return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Decimals per asset, so a column of amounts lines up on the point. BTC is
 * 8 because that is its unit; ETH 6 because 18 is unreadable and the last
 * twelve digits of a balance are never what anyone is reading for.
 *
 * These live here, next to the balances themselves, because two screens now
 * render them. The dashboard card and the portfolio card had no way to stay
 * in agreement while each kept its own copy.
 */
export function walletAssetDecimals(symbol: string): number {
	if (symbol === 'BTC') return 8;
	if (symbol === 'ETH') return 6;
	return 3;
}

/** A wallet balance as text, at its asset's fixed precision. */
export function formatWalletAmount(amount: number, symbol: string): string {
	const dp = walletAssetDecimals(symbol);
	return amount.toLocaleString(undefined, {
		minimumFractionDigits: dp,
		maximumFractionDigits: dp
	});
}

/** The sub-line under a balance: the asset's full name, plus any qualifier. */
export function walletAssetName(symbol: string, sub?: string): string {
	const base =
		symbol === 'HIVE'
			? 'Native Hive Token'
			: symbol === 'HBD'
				? 'Hive Backed Dollar'
				: symbol === 'BTC'
					? 'Bitcoin'
					: symbol === 'ETH'
						? 'Ethereum'
						: symbol;
	return sub ? `${base} · ${sub}` : base;
}
