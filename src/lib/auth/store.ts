import { readable, writable } from 'svelte/store';

type Auth = {
	status: 'none' | 'pending' | 'authenticated';
	value?: unknown;
};
export const _authStore = writable<Auth>({ status: 'none' });
export const authStore = readable<Auth>({ status: 'none' }, (set) => {
	_authStore.subscribe((v) => {
		set(v);
	});
});
