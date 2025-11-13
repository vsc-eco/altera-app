import { writable } from 'svelte/store';
import { GetAccountBalanceStore, GetContractStateStore } from '$houdini';
import { browser } from '$app/environment';
import { DHive } from '$lib/magiTransactions/dhive';
import { getAuth, type Auth } from '$lib/auth/store';
import { getUsernameFromAuth } from '$lib/getAccountName';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';

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

export type HiveMainnetBalance = {
	hbd: number;
	hive: number;
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
	}, 2000);
}

// testnet contract
export const MAPPINGCONTRACTID = 'vsc1BcS12fD42kKqL2SMLeBzaEKtd9QbBWC1dt';

async function fetchAccountData(auth: Auth) {
	if (!auth.value) return;
	const accKey = 'bal' + auth.value.did;

	try {
		if (!auth.value) throw 'Not authenticated';
		const accBalancesStore = new GetAccountBalanceStore();
		const contractStateStore = new GetContractStateStore();

		const username = getUsernameFromAuth(auth);
		const [magiBal, contractState, connectedBal] = await Promise.all([
			accBalancesStore.fetch({
				variables: { account: auth.value!.did },
				policy: 'NetworkOnly'
			}),
			contractStateStore.fetch({
				variables: { contractId: MAPPINGCONTRACTID, keys: [accKey] },
				policy: 'NetworkOnly'
			}),
			auth.value?.provider === 'aioha' && username
				? DHive.database.getAccounts([username])
				: undefined
		]);

		const contractBalances = contractState.data?.getStateByKeys[accKey];
		const btcBalance = contractBalances ?? 0;

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
		})();

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
