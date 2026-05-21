import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAllowedNodeUrl } from '$lib/nodeSelection/allowlist';

// The root layout sets `prerender = true`; opt out so this dynamic POST proxy
// is served as a serverless function instead of being prerendered (which would
// make it 404 at runtime — POST endpoints can't be prerendered).
export const prerender = false;

/**
 * Same-origin GraphQL proxy.
 *
 * The backend tightened CORS during the security audit, so the browser can no
 * longer fetch non-default GraphQL endpoints directly (preflight fails with no
 * `Access-Control-Allow-Origin`). This route forwards the request
 * server-to-server, where CORS doesn't apply.
 *
 * Request shape (from the browser):
 *   POST /api/gql?service=vsc        (or ?service=indexer)
 *   header  x-gql-upstream: <base URL of the chosen node>
 *   body    the raw GraphQL { query, variables } JSON
 *
 * The two services use different path suffixes:
 *   vsc      → <upstream>/api/v1/graphql
 *   indexer  → <upstream>/v1/graphql
 *
 * SSRF guard: the upstream is validated against the shared node allowlist, so
 * a hostile caller can't make us fetch arbitrary internal hosts.
 */

const PATH_BY_SERVICE: Record<string, string> = {
	vsc: '/api/v1/graphql',
	indexer: '/v1/graphql'
};

export const POST: RequestHandler = async ({ request, url, fetch }) => {
	const service = url.searchParams.get('service') ?? '';
	const path = PATH_BY_SERVICE[service];
	if (!path) {
		throw error(400, "service must be 'vsc' or 'indexer'");
	}

	const upstreamBase = request.headers.get('x-gql-upstream');
	if (!upstreamBase) {
		throw error(400, 'missing x-gql-upstream header');
	}
	if (!isAllowedNodeUrl(upstreamBase)) {
		throw error(403, 'upstream not allowed');
	}

	// Read the GraphQL body as text — we forward it verbatim, no parsing.
	const body = await request.text();

	const target = upstreamBase.replace(/\/+$/, '') + path;
	let upstreamRes: Response;
	try {
		upstreamRes = await fetch(target, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
			// Don't follow redirects: the allowlist only validates the initial
			// target, so a redirect could bounce us to an unvalidated host
			// (SSRF). GraphQL endpoints don't legitimately redirect a POST.
			redirect: 'error'
		});
	} catch (e) {
		console.error(`GQL proxy: upstream fetch failed for ${target}`, e);
		throw error(502, 'upstream request failed');
	}

	// Pass through the JSON response (GraphQL errors live inside it, so a
	// non-2xx upstream is still returned as-is for the client to handle).
	const text = await upstreamRes.text();
	try {
		return json(JSON.parse(text), { status: upstreamRes.status });
	} catch {
		// Upstream returned non-JSON (HTML error page, etc.) — surface a 502.
		console.error(`GQL proxy: non-JSON response from ${target}`);
		throw error(502, 'upstream returned non-JSON');
	}
};
