import { browser } from '$app/environment';
import { authStore, type Auth } from '$lib/auth/store';
import { error, redirect } from '@sveltejs/kit';
import '$lib/auth/reown';
import '$lib/auth/hive';

function isAuthenticated(): Promise<boolean> {
	let unsub = () => {};
	const out = new Promise<boolean>((resolve) => {
		unsub = authStore.subscribe((v) => {
			if (v.status == 'authenticated' || !browser) {
				console.log('authenticated with value ', v.value);
				resolve(true);
			}
			if (v.status == 'none') {
				resolve(false);
			}
		});
	});
	out.then(unsub);
	return out;
}

export async function load({ url }) {
	const authed = await isAuthenticated();
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
}
