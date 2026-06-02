import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Same-origin proxy for v4v.app's `/v1/cryptoprices/` endpoint.
 *
 * Mirrors the `/api/gql` pattern (CHANGELOG 0.3.7). v4v.app stopped sending
 * `Access-Control-Allow-Origin` on this endpoint, so the browser fetch fails
 * with a CORS error — cascading into market prices, pool USD volumes, and
 * balance USD conversions. This proxy forwards the request server-to-server,
 * where CORS doesn't apply.
 *
 * APP-09: same-origin only — reject cross-origin callers so this proxy
 * isn't a free relay for anyone else.
 */

const UPSTREAM_DEFAULT = 'https://api.v4v.app/v1/cryptoprices/';
const UPSTREAM_DEV = 'https://devapi.v4v.app/v1/cryptoprices/';

// Match the V4V dev-mode toggle used in src/lib/sendswap/v4v/config.ts.
function getUpstream(): string {
	const mode =
		env.PUBLIC_V4VAPP_API_MODE ?? env.VITE_V4VAPP_API_MODE ?? '';
	return mode === 'dev' ? UPSTREAM_DEV : UPSTREAM_DEFAULT;
}

export const GET: RequestHandler = async ({ url, request, fetch }) => {
	// APP-09: only same-origin browsers (the app itself) may call this proxy.
	// Browsers don't send `Origin` on same-origin GETs, so we also accept
	// `Sec-Fetch-Site: same-origin` — sent by all modern browsers (Chromium,
	// Firefox, Safari 16.4+) for same-origin requests. Direct URL navigations
	// have `Sec-Fetch-Site: none` and are rejected (this endpoint should only
	// be called programmatically by the app).
	const allowedOrigin = (env.ALTERA_ORIGIN || url.origin).toLowerCase();
	const reqOrigin = request.headers.get('origin');
	const fetchSite = request.headers.get('sec-fetch-site');
	const isSameOrigin =
		fetchSite === 'same-origin' ||
		(reqOrigin !== null && reqOrigin.toLowerCase() === allowedOrigin);
	if (!isSameOrigin) {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	try {
		const upstream = getUpstream();
		const res = await fetch(upstream);
		if (!res.ok) {
			return json(
				{ error: `Upstream returned ${res.status}` },
				{ status: res.status === 404 ? 404 : 502 }
			);
		}
		const data = await res.json();
		return json(data);
	} catch (err) {
		console.error('cryptoprices proxy error:', err);
		return json({ error: 'Failed to fetch upstream cryptoprices' }, { status: 502 });
	}
};
