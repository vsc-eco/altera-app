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

	// Chrome DevTools probes this on every local dev server — ignore it silently.
	if (event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response(null, { status: 204 });
	}

	return resolve(event);
};
