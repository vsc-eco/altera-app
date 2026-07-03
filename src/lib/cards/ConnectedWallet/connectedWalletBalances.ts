import { getHiveAccounts } from '$lib/auth/hive/getHiveAccounts';
import { isBtcTestnetAddress } from '$lib/stores/currentBalance';
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
	if (!wagmiConfig) return [];
	try {
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
	} catch {
		return [];
	}
}

/** BTC balance of the connected address via mempool.space's public API. */
export async function fetchBtcBalance(address: string): Promise<WalletBalance[]> {
	const base = isBtcTestnetAddress(address)
		? 'https://mempool.space/testnet/api'
		: 'https://mempool.space/api';
	try {
		const res = await fetch(`${base}/address/${address}`);
		if (!res.ok) return [];
		const d = await res.json();
		const sats =
			(d.chain_stats.funded_txo_sum ?? 0) -
			(d.chain_stats.spent_txo_sum ?? 0) +
			((d.mempool_stats?.funded_txo_sum ?? 0) - (d.mempool_stats?.spent_txo_sum ?? 0));
		return [{ symbol: 'BTC', amount: sats / 1e8, icon: '/btc/btc.svg' }];
	} catch {
		return [];
	}
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
