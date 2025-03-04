import { browser } from '$app/environment';
import { authStore } from '$lib/auth/store.js';
import { redirect } from '@sveltejs/kit';
import '$lib/auth/reown';
import '$lib/auth/hive';

function isAuthenticated(): Promise<boolean> {
	const out = new Promise<boolean>((resolve) => {
		authStore.subscribe((v) => {
			if (v.status == 'authenticated' || !browser) {
				console.log('authenticated with value ', v.value);
				resolve(true);
			}
			if (v.status == 'none') {
				resolve(false);
			}
		});
	});
	return out;
}

export async function load({ url }) {
	const authed = await isAuthenticated();
	if (browser && !authed) {
		localStorage.setItem('redirect_url', url.toString());
		redirect(307, '/login');
	}
}
