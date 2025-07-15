import { browser } from '$app/environment';
import { authStore, type Auth } from '$lib/auth/store';
import { redirect } from '@sveltejs/kit';
import '$lib/auth/reown';
import '$lib/auth/hive';

export const ssr = false;
export const prerender = false;

function isAuthenticated(): Promise<Auth | false> {
	const out = new Promise<Auth | false>((resolve) => {
		let unsubscribe: () => void = () => {};

		const handle = (v: Auth | { status: 'none', value: undefined }) => {
			if (v.status === 'authenticated' || !browser) {
				console.log('authenticated with value ', v.value);
				resolve(v);
				unsubscribe();
			} else if (v.status === 'none') {
				resolve(false);
				unsubscribe();
			}
		};

		unsubscribe = authStore.subscribe(handle);

	});
	return out;
}

export async function load({ url }) {
	const authed = await isAuthenticated();
	if (!browser) {
		return { auth: { status: 'pending' } as Auth };
	}
	if (!authed && url.pathname != '/login') {
		localStorage.setItem('redirect_url', url.toString());
		redirect(307, '/login');
	}
	return { auth: authed };
}
