import { redirect } from '@sveltejs/kit';

const authed = true;

export async function load() {
	if (!authed) {
		redirect(307, '/login');
	}
}
