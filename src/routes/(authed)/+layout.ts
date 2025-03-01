import { redirect } from '@sveltejs/kit';

const authed = false;

export async function load() {
	if (!authed) {
		redirect(307, '/login');
	}
}
