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
