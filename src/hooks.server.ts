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

	const response = await resolve(event);

	// APP-08: baseline security headers. CSP is kept intentionally permissive
	// (self + inline styles + the API/GQL/indexer/Hive hosts already in use,
	// ws/wss, data: images) so it hardens framing/sniffing without breaking
	// the app. frame-ancestors 'none' is the primary clickjacking control.
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(), microphone=(), camera=()'
	);
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data:",
			"connect-src 'self' https: wss: ws:",
			"frame-src 'self' https:",
			"frame-ancestors 'none'",
			"worker-src 'self'",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; ')
	);

	return response;
};
