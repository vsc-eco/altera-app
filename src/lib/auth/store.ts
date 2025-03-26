import { goto } from '$app/navigation';
import type { Aioha } from '@aioha/aioha';
import { getContext } from 'svelte';
import { readable, writable } from 'svelte/store';

export type Auth = {
	status: 'none' | 'pending' | 'authenticated';
	value?: unknown & {
		username?: string;
		address?: string;
		logout: () => Promise<void>;
		provider: 'aioha' | 'reown';
		openSettings: () => void;
		aioha?: Aioha;
	};
};

export const getAuth = () => {
	const fn = getContext<() => Auth>('auth');
	return fn();
};
export const _hiveAuthStore = writable<Auth>({ status: 'pending' });
export const _reownAuthStore = writable<Auth>({ status: 'pending' });
const changeLogout = (v: Auth) => {
	if (v.value) {
		const oldLogout = v.value.logout;
		v.value.logout = async () => {
			await oldLogout();
			goto('/logout');
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
