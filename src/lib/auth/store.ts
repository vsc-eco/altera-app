import type { Aioha } from '@aioha/aioha';
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
export const _hiveAuthStore = writable<Auth>({ status: 'pending' });
export const _reownAuthStore = writable<Auth>({ status: 'pending' });
// TODO: add signout function to auth object
export const authStore = readable<Auth>({ status: 'pending' }, (set) => {
	let hiveStatus = 'pending';
	let reownStatus = 'pending';
	_hiveAuthStore.subscribe((v) => {
		hiveStatus = v.status;
		if (hiveStatus == 'none' && reownStatus != 'none') {
			return;
		}
		set(v);
	});
	_reownAuthStore.subscribe((v) => {
		reownStatus = v.status;
		if (reownStatus == 'none' && hiveStatus != 'none') {
			return;
		}
		set(v);
	});
});
