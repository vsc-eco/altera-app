import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export async function load() {
	if (!dev) {
		error(404, { message: 'Not found' });
	}
}
