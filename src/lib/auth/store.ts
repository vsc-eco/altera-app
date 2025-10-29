import { goto } from '$app/navigation';
import type { Aioha } from '@aioha/aioha';
import { getContext } from 'svelte';
import { derived, writable } from 'svelte/store';
import { clearAllStores } from '$lib/stores/txStores';
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

export function cleanUpLogout() {
	clearAllStores();
	accountBalance.set({
		loading: true,
		bal: getDefaultBalance(),
		connectedBal: undefined
	});
	accountBalanceHistory.set([]);
	goto('/login');
}

export const getAuth = () => {
	const auth = getContext<() => Auth>('auth');
	return auth;
};
export const _hiveAuthStore = writable<Auth>({ status: 'pending' });
export const _reownAuthStore = writable<Auth>({ status: 'pending' });

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
