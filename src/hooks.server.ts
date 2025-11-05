import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const oldDomain = 'altera.vsc.eco';
	const newDomain = 'altera.magi.eco';

	if (event.url.hostname === oldDomain) {
		const newUrl = `https://${newDomain}${event.url.pathname}${event.url.search}`;

		return new Response(null, {
			status: 301,
			headers: {
				location: newUrl
			}
		});
	}

	return resolve(event);
};
