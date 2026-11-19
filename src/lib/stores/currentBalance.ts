import { writable } from 'svelte/store';
import { GetAccountBalanceStore, GetStateByKeysStore } from '$houdini';
import { browser } from '$app/environment';
import { DHive } from '$lib/magiTransactions/dhive';
import { getAuth, type Auth } from '$lib/auth/store';
import { getUsernameFromAuth } from '$lib/getAccountName';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import {
	BTC_MAPPING_CONTRACT_ID,
	ETH_CHAIN_ID,
	EVM_BRIDGE_CONTRACT_ID,
	EVM_BRIDGE_ENABLED,
	EVM_MIN_ETH_DEPOSIT_WEI,
	USDC_TOKEN_ADDRESS
} from '$lib/constants';
import { fromChainUnits } from '$lib/currency/chainAmount';
import { evmBalanceKey } from '$lib/magiTransactions/evmBridge';
import { queryOnce } from '$lib/queryOnce';
import {
	btcSendFeeReserve,
	fetchBtcFeeReserve,
	spendableSats,
	type MempoolAddressStats
} from '$lib/stores/btcSpendable';

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
		const result = await queryOnce(new GetStateByKeysStore(), {
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
 * The EVM bridge's proving fee per asset, in smallest units (its pf-<asset>
 * keys, prooffee.go): taken from every deposit and charged on top of every
 * withdrawal, also when the gas fee is deducted from the amount. The withdraw
 * max leaves room for it, as the BTC max leaves btcSendFeeReserve.
 */
export const evmProofFee = writable<{ eth: number; usdc: number }>({ eth: 0, usdc: 0 });

/**
 * Smallest deposit the bridge credits per asset, in smallest units (DUST-1:
 * less is not credited and stays in the vault). ETH's is a contract constant;
 * a token's is a tenth of the minimum withdrawal in its registry entry
 * (t-<chain>-<address> = "symbol|decimals|minWithdrawal|..."). null = not
 * known yet, and the deposit page does not send.
 */
export const evmMinDeposit = writable<{ eth: number; usdc: number | null }>({
	eth: EVM_MIN_ETH_DEPOSIT_WEI,
	usdc: null
});

/**
 * ETH and USDC held on Magi: the EVM bridge's ledger keys, stored as decimal
 * strings (wei / USDC's 6 places), under the account's canonical DID. Zero
 * when the bridge is not enabled on this network.
 */
async function fetchEvmBalances(did: string): Promise<{ eth: number; usdc: number }> {
	if (!EVM_BRIDGE_ENABLED) return { eth: 0, usdc: 0 };
	const ethKey = evmBalanceKey(did, Coin.eth.value);
	const usdcKey = evmBalanceKey(did, Coin.usdc.value);
	const usdcRegistryKey = `t-${ETH_CHAIN_ID}-${USDC_TOKEN_ADDRESS.slice(2).toLowerCase()}`;
	try {
		const result = await queryOnce(new GetStateByKeysStore(), {
			variables: {
				contractId: EVM_BRIDGE_CONTRACT_ID,
				keys: [ethKey, usdcKey, 'pf-eth', 'pf-usdc', usdcRegistryKey]
			},
			policy: 'NetworkOnly'
		});
		const state = (result.data?.getStateByKeys ?? {}) as Record<string, string | null>;
		evmProofFee.set({
			eth: fromChainUnits(state['pf-eth'], Coin.eth),
			usdc: fromChainUnits(state['pf-usdc'], Coin.usdc)
		});
		const usdcMinWithdrawal = Number((state[usdcRegistryKey] ?? '').split('|')[2]);
		evmMinDeposit.set({
			eth: EVM_MIN_ETH_DEPOSIT_WEI,
			// MinDeposit() = MinWithdrawal / MinDepositDivisor (10)
			usdc:
				Number.isFinite(usdcMinWithdrawal) && usdcMinWithdrawal > 0
					? Math.floor(usdcMinWithdrawal / 10)
					: null
		});
		return {
			eth: fromChainUnits(state[ethKey], Coin.eth),
			usdc: fromChainUnits(state[usdcKey], Coin.usdc)
		};
	} catch (err) {
		console.error('Failed to fetch ETH/USDC balances', err);
		return { eth: 0, usdc: 0 };
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
 * API: what the wallet can spend now, in sats (confirmed coins less
 * what pending payments spend; unconfirmed change is not spendable
 * yet). Used for the QuickSwap card and /swap so reown-BTC users see
 * their real wallet max instead of the Magi-mapped balance. Also
 * refreshes the miner-fee reserve a send must leave room for.
 */
async function fetchOnChainBtcBalance(address: string): Promise<number> {
	if (!address) return 0;
	const base = isBtcTestnetAddress(address)
		? 'https://mempool.space/testnet/api/address/'
		: 'https://mempool.space/api/address/';
	try {
		const [res, reserve] = await Promise.all([
			fetch(`${base}${address}`),
			fetchBtcFeeReserve(isBtcTestnetAddress(address))
		]);
		btcSendFeeReserve.set(reserve);
		if (!res.ok) return 0;
		return spendableSats((await res.json()) as MempoolAddressStats);
	} catch (err) {
		console.error('Failed to fetch on-chain BTC balance', err);
		return 0;
	}
}

export type AccountBalance = {
	hbd: number;
	hbd_savings: number;
	/** Block height of the last sHBD interest payout (mirrors Hive's
	 *  savings_hbd_last_interest_payment). Used to estimate the next payout. */
	hbd_claim: number;
	pending_hbd_unstaking: number;
	hive: number;
	hive_consensus: number;
	consensus_unstaking: number;
	btc: number;
	/** wei, rounded down to whole gwei (chainAmount.fromChainUnits) */
	eth: number;
	usdc: number;
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
		hbd_claim: 0,
		pending_hbd_unstaking: 0,
		hive: 0,
		hive_consensus: 0,
		consensus_unstaking: 0,
		btc: 0,
		eth: 0,
		usdc: 0,
		resource_credits: 0,
		last_tx_height: 0
	};
}

let intervalId: NodeJS.Timeout | null = null;
/**
 * DID the running interval polls for, or null when idle. The interval captures
 * its `auth` in a closure, so it must be torn down and restarted when the user
 * switches account — otherwise it keeps writing the PREVIOUS account's
 * balances into the store every 5s and the dashboard never updates.
 */
let pollingDid: string | null = null;

export function startAccountPolling(auth: Auth) {
	if (!browser || !auth.value) return;

	const did = auth.value.did;
	// Already polling this account: leave the running interval alone (the
	// layout effect re-runs on unrelated auth changes, e.g. the profile
	// picture being filled in).
	if (pollingDid === did) return;

	// Different account (or first start): drop the old loop, including any
	// in-flight request, before starting the new one.
	stopAccountPolling();
	pollingDid = did;

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
		const requestedDid = auth.value.did;
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

		const [magiBal, btcBalance, connectedBal, onChainBtcBalance, evmBalances] = await Promise.all([
			queryOnce(accBalancesStore, {
				variables: { account: auth.value!.did },
				policy: 'NetworkOnly'
			}),
			fetchBtcBalance(auth.value!.did),
			auth.value?.provider === 'aioha' && username
				? DHive.database.getAccounts([username])
				: undefined,
			btcWalletAddress ? fetchOnChainBtcBalance(btcWalletAddress) : Promise.resolve(undefined),
			fetchEvmBalances(auth.value!.did)
		]);

		const magiBalanceObj = (() => {
			if (magiBal.data) {
				const resultBal = magiBal.data.getAccountBalance;
				const resultRC = magiBal.data.getAccountRC;

				const balances: AccountBalance = {
					hbd: resultBal?.hbd ?? 0,
					hbd_savings: resultBal?.hbd_savings ?? 0,
					hbd_claim: resultBal?.hbd_claim ?? 0,
					pending_hbd_unstaking: resultBal?.pending_hbd_unstaking ?? 0,
					hive: resultBal?.hive ?? 0,
					hive_consensus: resultBal?.hive_consensus ?? 0,
					consensus_unstaking: resultBal?.consensus_unstaking ?? 0,
					btc: btcBalance,
					eth: evmBalances.eth,
					usdc: evmBalances.usdc,
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

		// The user may have switched account while these requests were in
		// flight. Dropping the response keeps the previous account's balances
		// from landing in the store after the switch cleared it.
		if (pollingDid !== requestedDid) return;

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
	}
	// Also invalidates any in-flight fetchAccountData response.
	pollingDid = null;
}
