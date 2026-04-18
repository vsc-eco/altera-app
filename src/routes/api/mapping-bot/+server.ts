import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The mapping bot runs outside our infra and has no CORS headers,
// so the browser can't read its response body cross-origin even
// when the POST succeeds. This endpoint proxies the request from
// our own backend so it's same-origin from the browser's POV.
export const prerender = false;

const MAPPING_BOT_MAINNET = 'https://btc.magi.milohpr.com';
const MAPPING_BOT_TESTNET = 'https://btc.testnet.magi.milohpr.com';

export const POST: RequestHandler = async ({ request }) => {
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

	const network = body.network === 'testnet' ? 'testnet' : 'mainnet';
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
