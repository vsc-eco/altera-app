import { goto } from '$app/navigation';
import type { Aioha } from '@aioha/aioha';
import { getContext } from 'svelte';
import { derived, readable, writable, type Writable } from 'svelte/store';
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

// export const authStoreOld = readable<Auth>({ status: 'pending' }, (set) => {
// 	let hiveStatus = 'pending';
// 	let reownStatus = 'pending';
// 	const newSet = (value: Auth) => {
// 		changeLogout(value);
// 		set(value);
// 	};
// 	_hiveAuthStore.subscribe((v) => {
// 		console.log('new hiveauthstore value', v);
// 		hiveStatus = v.status;
// 		if (hiveStatus === 'none' && reownStatus !== 'none') {
// 			console.log('returning, reown status ===', reownStatus);
// 			return;
// 		}
// 		newSet(v);
// 	});
// 	_reownAuthStore.subscribe((v) => {
// 		reownStatus = v.status;
// 		if (reownStatus === 'none' && hiveStatus !== 'none') {
// 			return;
// 		}
// 		newSet(v);
// 	});
// });

export const loginRetry = writable<'idle' | 'retry' | 'cooldown' | 'logout'>('idle');
