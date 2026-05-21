/**
 * Allowlist for node/upstream URLs.
 *
 * Used in two places:
 *  - select.ts: gating manual node overrides (APP-03/04)
 *  - routes/api/gql/+server.ts: SSRF guard on the GraphQL proxy's
 *    `x-gql-upstream` header — the server will only forward to a host
 *    on this list, so a hostile client can't turn the proxy into an
 *    open relay.
 */
export const ALLOWED_ROOT_DOMAINS = [
	'okinoko.io',
	'magi.eco',
	'vsc.eco',
	'techcoderx.com',
	'milohpr.com',
	'hive.blog',
	'openhive.network',
	'deathwing.me'
];

/**
 * True when `raw` is an https URL whose host is one of ALLOWED_ROOT_DOMAINS
 * (or a subdomain), or an http URL on localhost (dev only).
 */
export function isAllowedNodeUrl(raw: string): boolean {
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		return false;
	}
	const host = u.hostname.toLowerCase();
	const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
	if (u.protocol === 'http:') {
		if (!isLocalhost) return false;
	} else if (u.protocol !== 'https:') {
		return false;
	}
	if (isLocalhost) return true;
	return ALLOWED_ROOT_DOMAINS.some((root) => host === root || host.endsWith('.' + root));
}
