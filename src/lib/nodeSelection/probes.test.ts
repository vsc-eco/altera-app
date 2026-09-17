import { describe, it, expect, vi, afterEach } from 'vitest';
import { probeIndexer, probeVscApi, probeHiveRpc } from './probes';

afterEach(() => vi.unstubAllGlobals());

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
	vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
		const body = handler(url, init);
		if (body instanceof Error) throw body;
		return { ok: true, status: 200, json: async () => body } as Response;
	}));
}

describe('probeIndexer', () => {
	it('picks the node with the most recent contract_logs.ts', async () => {
		mockFetch((url) => {
			if (url.startsWith('https://old'))
				return { data: { contract_logs: [{ ts: '2026-05-01T00:00:00Z' }] } };
			return { data: { contract_logs: [{ ts: '2026-05-19T00:00:00Z' }] } };
		});
		const pick = await probeIndexer(['https://old.example', 'https://new.example']);
		expect(pick).toBe('https://new.example');
	});
	it('falls back to first node when all fail', async () => {
		mockFetch(() => new Error('down'));
		const pick = await probeIndexer(['https://a', 'https://b']);
		expect(pick).toBe('https://a');
	});
});

describe('probeVscApi', () => {
	it('picks the node with the highest last_processed_block', async () => {
		mockFetch((url) => {
			if (url.startsWith('https://lo'))
				return { data: { localNodeInfo: { last_processed_block: 100 } } };
			return { data: { localNodeInfo: { last_processed_block: 999 } } };
		});
		const pick = await probeVscApi(['https://lo.example', 'https://hi.example']);
		expect(pick).toBe('https://hi.example');
	});
});

describe('probeHiveRpc', () => {
	it('ranks by head_block_number, /health only as tie-breaker', async () => {
		mockFetch((url, init) => {
			const isRpc = init?.method === 'POST';
			if (url.startsWith('https://lo')) {
				if (!isRpc) return {}; // /health 200 but lower block
				return { result: { head_block_number: 1000 } };
			}
			if (!isRpc) return new Error('no /health'); // hi: no health endpoint
			return { result: { head_block_number: 9999 } };
		});
		const pick = await probeHiveRpc(['https://lo.example', 'https://hi.example']);
		expect(pick).toBe('https://hi.example'); // higher head wins despite no /health
	});
	it('falls back to first node when all fail', async () => {
		mockFetch(() => new Error('down'));
		const pick = await probeHiveRpc(['https://h1', 'https://h2']);
		expect(pick).toBe('https://h1');
	});
});

/** Mock fetch where each host can be given its own artificial round trip. */
function mockFetchWithLatency(
	handler: (url: string, init?: RequestInit) => unknown,
	delayFor: (url: string) => number
) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			await new Promise((r) => setTimeout(r, delayFor(url)));
			const body = handler(url, init);
			if (body instanceof Error) throw body;
			return { ok: true, status: 200, json: async () => body } as Response;
		})
	);
}

describe('latency ranking', () => {
	it('prefers the faster node when both are equally current', async () => {
		mockFetchWithLatency(
			() => ({ data: { localNodeInfo: { last_processed_block: 500 } } }),
			(url) => (url.startsWith('https://slow') ? 60 : 5)
		);
		const pick = await probeVscApi(['https://slow.example', 'https://fast.example']);
		expect(pick).toBe('https://fast.example');
	});

	it('does not trade real latency for a one-block lead', async () => {
		// The regression this guards: ranking purely by freshness handed the
		// pick to a node 10x slower because it happened to be 1 block ahead.
		mockFetchWithLatency(
			(url) => ({
				data: {
					localNodeInfo: {
						last_processed_block: url.startsWith('https://slow') ? 501 : 500
					}
				}
			}),
			(url) => (url.startsWith('https://slow') ? 60 : 5)
		);
		const pick = await probeVscApi(['https://slow.example', 'https://fast.example']);
		expect(pick).toBe('https://fast.example');
	});

	it('still rejects a fast node that is genuinely behind', async () => {
		// Outside FRESHNESS_TOLERANCE.vsc (20 blocks) speed must not rescue it.
		mockFetchWithLatency(
			(url) => ({
				data: {
					localNodeInfo: {
						last_processed_block: url.startsWith('https://fast') ? 100 : 500
					}
				}
			}),
			(url) => (url.startsWith('https://fast') ? 5 : 60)
		);
		const pick = await probeVscApi(['https://fast.example', 'https://current.example']);
		expect(pick).toBe('https://current.example');
	});

	it('ranks the indexer by latency within the freshness tolerance', async () => {
		const now = Date.now();
		mockFetchWithLatency(
			(url) => ({
				data: {
					contract_logs: [
						{
							// 5s apart: well inside the 60s indexer tolerance.
							ts: new Date(url.startsWith('https://slow') ? now : now - 5_000).toISOString()
						}
					]
				}
			}),
			(url) => (url.startsWith('https://slow') ? 60 : 5)
		);
		const pick = await probeIndexer(['https://slow.example', 'https://fast.example']);
		expect(pick).toBe('https://fast.example');
	});
});
