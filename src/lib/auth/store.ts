import { goto } from '$app/navigation';
import type { Aioha } from '@aioha/aioha';
import { getContext } from 'svelte';
import { derived, writable } from 'svelte/store';
import { clearAllStores } from '$lib/stores/txStores';
import { clearLocalTransactions } from '$lib/stores/localStorageTxs';
import { clearNotifications } from '$lib/Topbar/notifications';
import { accountBalance, getDefaultBalance } from '$lib/stores/currentBalance';
import { accountBalanceHistory } from '$lib/stores/balanceHistory';

export type Auth = {
	status: 'none' | 'pending' | 'authenticated';
	value?: unknown & {
		username?: string;
		address: string;
		did: string;
		logout: () => Promise<void>;
		provider: 'aioha' | 'reown';
		openSettings: () => void;
		profilePicUrl?: string | undefined;
		aioha?: Aioha;
	};
};

/**
 * Clear everything scoped to the signed-in ACCOUNT (notifications, pending
 * txs, balances). Called on logout AND on account switching — notifications
 * and pending transactions live under global localStorage keys, so without
 * this the next account inherits the previous account's data (the
 * cross-account leak fixed in 0.3.x would come back via switching).
 */
export function cleanUpAccountData() {
	clearAllStores();
	clearNotifications();
	clearLocalTransactions();
	accountBalance.set({
		loading: true,
		bal: getDefaultBalance(),
		connectedBal: undefined
	});
	accountBalanceHistory.set([]);
}

export function cleanUpLogout() {
	cleanUpAccountData();
	goto('/login');
}

export const getAuth = () => {
	const auth = getContext<() => Auth>('auth');
	return auth;
};
export const _hiveAuthStore = writable<Auth>({ status: 'pending' });
export const _reownAuthStore = writable<Auth>({ status: 'none' });

export const authStore = derived([_hiveAuthStore, _reownAuthStore], ([$hive, $reown]) => {
	if ($hive.status !== 'none') {
		return $hive;
	} else if ($reown.status !== 'none') {
		return $reown;
	} else {
		const noneAuth = { status: 'none' as const };
		return noneAuth as Auth;
	}
});

export const loginRetry = writable<'idle' | 'retry' | 'cooldown' | 'logout'>('idle');
