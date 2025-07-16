import { goto } from '$app/navigation';
import type { Aioha } from '@aioha/aioha';
import { getContext } from 'svelte';
import { readable, writable } from 'svelte/store';
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

export const getAuth = () => {
	const auth = getContext<() => Auth>('auth');
	return auth;
};
export const _hiveAuthStore = writable<Auth>({ status: 'pending' });
export const _reownAuthStore = writable<Auth>({ status: 'pending' });
const changeLogout = (v: Auth) => {
	if (v.value) {
		const oldLogout = v.value.logout;
		v.value.logout = async () => {
			loginRetry.set('logout');
			await oldLogout();
			console.log('supposedly done with logout');
			// clear svelte stores
			clearAllStores();
			accountBalance.set({
				loading: true,
				bal: getDefaultBalance()
			});
			accountBalanceHistory.set([]);
			goto('/login');
		};
	}
};
export const authStore = readable<Auth>({ status: 'pending' }, (set) => {
	let hiveStatus = 'pending';
	let reownStatus = 'pending';
	const newSet = (value: Auth) => {
		changeLogout(value);
		set(value);
	};
	_hiveAuthStore.subscribe((v) => {
		hiveStatus = v.status;
		if (hiveStatus == 'none' && reownStatus != 'none') {
			return;
		}
		newSet(v);
	});
	_reownAuthStore.subscribe((v) => {
		reownStatus = v.status;
		if (reownStatus == 'none' && hiveStatus != 'none') {
			return;
		}
		newSet(v);
	});
});

export const loginRetry = writable<'idle' | 'retry' | 'cooldown' | 'logout'>('idle');
