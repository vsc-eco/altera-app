import { writable } from 'svelte/store';
import { GetAccountBalanceStore, GetStateByKeysStore } from '$houdini';
import { browser } from '$app/environment';
import { DHive } from '$lib/magiTransactions/dhive';
import { getAuth, type Auth } from '$lib/auth/store';
import { getUsernameFromAuth } from '$lib/getAccountName';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';

type AccountBalanceSnapshot = {
	bal: AccountBalance;
	connectedBal: HiveMainnetBalance | undefined;
};

/**
 * Resolve a raw balance (in smallest units) for a given coin on a given network
 * from the current balance snapshot. Returns 0 if no balance is tracked for the
 * combination.
 *
 * - Magi network reads from `bal` (on-chain VSC balances)
 * - Hive Mainnet reads from `connectedBal` (L1 Hive account balances)
 * - BTC is only tracked on Magi (mapping contract)
 * - All other network/coin combos fall back to 0
 */
export function getBalanceSmallestUnits(
	snapshot: AccountBalanceSnapshot | undefined | null,
	coin: (typeof Coin)[keyof typeof Coin],
	network: (typeof Network)[keyof typeof Network]
): number {
	if (!snapshot) return 0;
	// Mainnet reads from the connected wallet. BTC mainnet comes from
	// the reown BitcoinAdapter's on-chain address (via mempool.space),
	// Hive mainnet comes from the aioha L1 account snapshot.
	if (network.value === Network.hiveMainnet.value || network.value === Network.btcMainnet.value) {
		const val = snapshot.connectedBal?.[coin.value as keyof HiveMainnetBalance];
		return typeof val === 'number' ? val : 0;
	}
	const val = snapshot.bal?.[coin.value as keyof AccountBalance];
	return typeof val === 'number' ? val : 0;
}

/**
 * Returns a `CoinAmount` for the given coin/network balance, ready for display
 * or arithmetic. Values >= 0, zero when no balance is available.
 */
export function getBalanceAmount<C extends (typeof Coin)[keyof typeof Coin]>(
	snapshot: AccountBalanceSnapshot | undefined | null,
	coin: C,
	network: (typeof Network)[keyof typeof Network]
): CoinAmount<C> {
	const raw = getBalanceSmallestUnits(snapshot, coin, network);
	return new CoinAmount(raw, coin, true);
}

async function fetchBtcBalance(did: string): Promise<number> {
	try {
		const result = await new GetStateByKeysStore().fetch({
			variables: {
				contractId: BTC_MAPPING_CONTRACT_ID,
				keys: [`a-${did}`],
				encoding: 'hex'
			},
			policy: 'NetworkOnly'
		});
		const state = result.data?.getStateByKeys;
		if (!state) return 0;
		const hex = state[`a-${did}`];
		if (!hex || typeof hex !== 'string') return 0;
		return parseInt(hex, 16) || 0;
	} catch (err) {
		console.error('Failed to fetch BTC balance', err);
		return 0;
	}
}

/**
 * Detect Bitcoin network from address prefix. `tb1`, `2`, `m` and
 * `n` are testnet (including regtest which shares the same prefixes
 * as testnet3); everything else is mainnet.
 */
export function isBtcTestnetAddress(address: string): boolean {
	if (!address) return false;
	if (address.startsWith('tb1') || address.startsWith('bcrt1')) return true;
	const first = address[0];
	return first === '2' || first === 'm' || first === 'n';
}

/**
 * On-chain Bitcoin wallet balance via mempool.space's public REST
 * API. Returns sats (confirmed + unconfirmed mempool net). Used for
 * the QuickSwap card so reown-BTC users see their real wallet max
 * instead of the Magi-mapped balance — QuickSwap is a mainnet↔
 * mainnet cross-chain swap so the Leather wallet balance is the
 * right cap.
 */
async function fetchOnChainBtcBalance(address: string): Promise<number> {
	if (!address) return 0;
	const base = isBtcTestnetAddress(address)
		? 'https://mempool.space/testnet/api/address/'
		: 'https://mempool.space/api/address/';
	try {
		const res = await fetch(`${base}${address}`);
		if (!res.ok) return 0;
		const data = (await res.json()) as {
			chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
			mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
		};
		const confirmed =
			(data.chain_stats?.funded_txo_sum ?? 0) - (data.chain_stats?.spent_txo_sum ?? 0);
		const unconfirmed =
			(data.mempool_stats?.funded_txo_sum ?? 0) - (data.mempool_stats?.spent_txo_sum ?? 0);
		return Math.max(0, confirmed + unconfirmed);
	} catch (err) {
		console.error('Failed to fetch on-chain BTC balance', err);
		return 0;
	}
}

export type AccountBalance = {
	hbd: number;
	hbd_savings: number;
	pending_hbd_unstaking: number;
	hive: number;
	hive_consensus: number;
	consensus_unstaking: number;
	btc: number;
	resource_credits: number;
	last_tx_height: number;
};

/**
 * Native mainnet balances for the user's connected wallets. `hive`
 * and `hbd` come from the Hive L1 account (aioha only). `btc` is the
 * on-chain Bitcoin wallet balance (reown Bitcoin adapter only) and
 * stays `undefined` when no Bitcoin wallet is connected.
 */
export type HiveMainnetBalance = {
	hbd: number;
	hive: number;
	btc?: number;
};

// svelte store for current balance (updated in AccBalance.svelte)
export const accountBalance = writable<{
	bal: AccountBalance;
	connectedBal: HiveMainnetBalance | undefined;
	loading: boolean;
}>({
	bal: getDefaultBalance(),
	connectedBal: undefined,
	loading: true
});

export function getDefaultBalance(): AccountBalance {
	return {
		hbd: 0,
		hbd_savings: 0,
		pending_hbd_unstaking: 0,
		hive: 0,
		hive_consensus: 0,
		consensus_unstaking: 0,
		btc: 0,
		resource_credits: 0,
		last_tx_height: 0
	};
}

let isPolling = false;
let intervalId: NodeJS.Timeout | null = null;

export function startAccountPolling(auth: Auth) {
	const did = auth.value!.did;
	if (!browser || isPolling) return; // Prevent multiple intervals

	isPolling = true;

	// Initial fetch
	fetchAccountData(auth);

	// Set up interval
	intervalId = setInterval(() => {
		fetchAccountData(auth);
	}, 5000);
}

async function fetchAccountData(auth: Auth) {
	try {
		if (!auth.value) throw 'Not authenticated';
		const accBalancesStore = new GetAccountBalanceStore();

		const username = getUsernameFromAuth(auth);

		// Reown Bitcoin wallets (Leather, Xverse, etc.) — fetch the
		// on-chain BTC balance from mempool.space so the QuickSwap
		// mainnet↔mainnet flow can show a real Max for BTC. EVM
		// reown wallets have no BTC on-chain balance and stay
		// undefined here.
		const isReownBtc =
			auth.value?.provider === 'reown' && auth.value.did?.startsWith('did:pkh:bip122:');
		const btcWalletAddress = isReownBtc ? auth.value!.address : undefined;

		const [magiBal, btcBalance, connectedBal, onChainBtcBalance] = await Promise.all([
			accBalancesStore.fetch({
				variables: { account: auth.value!.did },
				policy: 'NetworkOnly'
			}),
			fetchBtcBalance(auth.value!.did),
			auth.value?.provider === 'aioha' && username
				? DHive.database.getAccounts([username])
				: undefined,
			btcWalletAddress ? fetchOnChainBtcBalance(btcWalletAddress) : Promise.resolve(undefined)
		]);

		const magiBalanceObj = (() => {
			if (magiBal.data) {
				const resultBal = magiBal.data.getAccountBalance;
				const resultRC = magiBal.data.getAccountRC;

				const balances: AccountBalance = {
					hbd: resultBal?.hbd ?? 0,
					hbd_savings: resultBal?.hbd_savings ?? 0,
					pending_hbd_unstaking: resultBal?.pending_hbd_unstaking ?? 0,
					hive: resultBal?.hive ?? 0,
					hive_consensus: resultBal?.hive_consensus ?? 0,
					consensus_unstaking: resultBal?.consensus_unstaking ?? 0,
					btc: btcBalance,
					resource_credits: resultRC?.amount ?? 0,
					last_tx_height: resultRC?.block_height ?? 0
				};
				return balances;
			}
		})();

		const connectedBalanceObj = (() => {
			if (connectedBal) {
				const acc = connectedBal[0];
				const hiveBalance =
					typeof acc.balance === 'string'
						? parseFloat(acc.balance.split(' ')[0])
						: acc.balance.amount;
				const hbdBalance =
					typeof acc.hbd_balance === 'string'
						? parseFloat(acc.hbd_balance.split(' ')[0])
						: acc.hbd_balance.amount;
				const balances: HiveMainnetBalance = {
					hive: new CoinAmount(hiveBalance, Coin.hive).amount,
					hbd: new CoinAmount(hbdBalance, Coin.hbd).amount
				};
				return balances;
			}
			if (typeof onChainBtcBalance === 'number') {
				// Reown BTC wallet without a Hive L1 account — connectedBal
				// still exists, just with zero HIVE/HBD.
				return {
					hive: 0,
					hbd: 0,
					btc: onChainBtcBalance
				} satisfies HiveMainnetBalance;
			}
		})();
		if (connectedBalanceObj && typeof onChainBtcBalance === 'number') {
			connectedBalanceObj.btc = onChainBtcBalance;
		}

		if (magiBalanceObj && connectedBalanceObj) {
			accountBalance.set({
				bal: magiBalanceObj,
				connectedBal: connectedBalanceObj,
				loading: false
			});
		} else if (magiBalanceObj) {
			accountBalance.update((current) => ({
				...current,
				bal: magiBalanceObj,
				loading: false
			}));
		} else if (connectedBalanceObj) {
			accountBalance.update((current) => ({
				...current,
				connectedBal: connectedBalanceObj,
				loading: false
			}));
		}
	} catch (error) {
		console.error('Failed to fetch account data:', error);
	}
}

export function stopAccountPolling() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
		isPolling = false;
	}
}
