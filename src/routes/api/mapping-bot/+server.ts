import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// The mapping bot runs outside our infra and has no CORS headers,
// so the browser can't read its response body cross-origin even
// when the POST succeeds. This endpoint proxies the request from
// our own backend so it's same-origin from the browser's POV.
export const prerender = false;

const MAPPING_BOT_MAINNET = 'https://btc.magi.milohpr.com';
const MAPPING_BOT_TESTNET = 'https://btc.testnet.magi.milohpr.com';

export const POST: RequestHandler = async ({ request, url }) => {
	// APP-05: reject cross-origin callers — this is an internal same-origin proxy.
	const allowedOrigin = (env.ALTERA_ORIGIN || url.origin).toLowerCase();
	const reqOrigin = request.headers.get('origin');
	if (reqOrigin === null || reqOrigin.toLowerCase() !== allowedOrigin) {
		throw error(403, 'forbidden');
	}

	let body: { instruction?: unknown; network?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'invalid request body');
	}

	const instruction = typeof body.instruction === 'string' ? body.instruction : '';
	if (!instruction) {
		throw error(400, 'instruction required');
	}

	// APP-05: require an explicit, valid network — no silent mainnet default.
	if (body.network !== 'testnet' && body.network !== 'mainnet') {
		throw error(400, "network must be 'testnet' or 'mainnet'");
	}
	const network = body.network;
	const upstream = network === 'testnet' ? MAPPING_BOT_TESTNET : MAPPING_BOT_MAINNET;

	const res = await fetch(upstream, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ instruction })
	});

	const text = await res.text();
	if (!res.ok) {
		throw error(res.status, text || 'mapping bot error');
	}

	// Parse the plain-text response format:
	//   "address mapping (created|exists): <addr> -> <instruction>"
	const match = text.match(/address mapping (?:created|exists): (\S+)/);
	if (!match) {
		throw error(502, `unexpected mapping bot response: ${text}`);
	}

	return json({ address: match[1], raw: text });
};
