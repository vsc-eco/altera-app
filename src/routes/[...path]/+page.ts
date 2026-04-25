import { error } from '@sveltejs/kit';

export const prerender = false;

export function load() {
	error(404, 'Page not found');
}
