import { writable } from 'svelte/store';
import { GetAccountBalanceStore } from '$houdini';

export type AccountBalance = {
	hbd: number;
	hbd_savings: number;
	pending_hbd_unstaking: number;
	hive: number;
	hive_consensus: number;
	consensus_unstaking: number;
	resource_credits: number;
	last_tx_height: number;
};

// svelte store for current balance (updated in AccBalance.svelte)
export const accountBalance = writable<{ bal: AccountBalance; loading: boolean }>({
	bal: getDefaultBalance(),
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
		resource_credits: 0,
		last_tx_height: 0
	};
}

let isPolling = false;
let intervalId: NodeJS.Timeout | null = null;

export function startAccountPolling(did: string) {
	if (isPolling) return; // Prevent multiple intervals

	isPolling = true;
	const api = new GetAccountBalanceStore();

	// Initial fetch
	fetchAccountData(api, did);

	// Set up interval
	intervalId = setInterval(() => {
		fetchAccountData(api, did);
	}, 2000);
}

async function fetchAccountData(api: any, did: string) {
	try {
		const result = await api.fetch({
			variables: { account: did },
			policy: 'NetworkOnly'
		});

		if (result.data) {
			const resultBal = result.data.getAccountBalance;
			const resultRC = result.data.getAccountRC;

			const balances: AccountBalance = {
				hbd: resultBal?.hbd ?? 0,
				hbd_savings: resultBal?.hbd_savings ?? 0,
				pending_hbd_unstaking: resultBal?.pending_hbd_unstaking ?? 0,
				hive: resultBal?.hive ?? 0,
				hive_consensus: resultBal?.hive_consensus ?? 0,
				consensus_unstaking: resultBal?.consensus_unstaking ?? 0,
				resource_credits: resultRC?.amount ?? 0,
				last_tx_height: resultRC?.block_height ?? 0
			};

			accountBalance.set({ bal: balances, loading: false });
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
