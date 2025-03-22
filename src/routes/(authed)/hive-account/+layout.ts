import { browser } from '$app/environment';
import { authStore, type Auth } from '$lib/auth/store';
import { error, redirect } from '@sveltejs/kit';
import '$lib/auth/reown';
import '$lib/auth/hive';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async function load({ url, parent }) {
	const authed = await parent();
	if (browser && !authed) {
		localStorage.setItem('redirect_url', url.toString());
		redirect(307, '/login');
	}
	let unsub = () => {};
	const account = await new Promise<Auth>((resolve) => {
		if (!browser) resolve({ status: 'pending' });
		unsub = authStore.subscribe((v) => {
			if (v.status == 'authenticated') resolve(v);
		});
	});
	unsub();
	if (account.status == 'pending' || account.value?.provider == 'aioha') {
		return;
	}
	error(401, `You must be signed in with a hive account in order to access this page.`);
};
