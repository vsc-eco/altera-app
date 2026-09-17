import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// $app/environment → pretend we're in the browser
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('./env', () => ({
	GQL_PATH: { vsc: '/api/v1/graphql', indexer: '/v1/graphql' },
	nodesFor: (cat: string, network: string) => {
		const testnet = network === 'vsc-testnet';
		if (cat === 'indexer')
			return testnet ? ['https://idx-testnet'] : ['https://idx-default', 'https://idx-2'];
		if (cat === 'vsc') return testnet ? ['https://vsc-testnet-node'] : ['https://vsc-default'];
		return ['https://hive-default'];
	}
}));

import {
	resolveNodeUrl,
	refreshNode,
	isManualMode,
	autoSelectedNodeUrl,
	orderedNodeUrls,
	gqlEndpoints,
	currentNetwork
} from './select';

class MemStorage {
	m = new Map<string, string>();
	getItem(k: string) {
		return this.m.has(k) ? this.m.get(k)! : null;
	}
	setItem(k: string, v: string) {
		this.m.set(k, v);
	}
	removeItem(k: string) {
		this.m.delete(k);
	}
	clear() {
		this.m.clear();
	}
	key() {
		return null;
	}
	get length() {
		return this.m.size;
	}
}

beforeEach(() => {
	vi.stubGlobal('localStorage', new MemStorage());
	vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe('resolveNodeUrl precedence', () => {
	it('cold start → first env node', () => {
		expect(resolveNodeUrl('indexer')).toBe('https://idx-default');
	});
	it('auto cache wins over env default', () => {
		localStorage.setItem('node-auto-indexer', 'https://cached-idx');
		expect(resolveNodeUrl('indexer')).toBe('https://cached-idx');
	});
	// Manual-override fixtures must be allowlisted hosts: resolveNodeUrl gates
	// them through isAllowedNodeUrl (APP-03/04), so a bare label like
	// `https://my-manual` would be rejected and fall through to the default.
	it('manual mode + manual key beats auto cache', () => {
		localStorage.setItem('node-auto-indexer', 'https://cached-idx.okinoko.io');
		localStorage.setItem('node-mode-indexer', 'manual');
		localStorage.setItem('magi-indexer-url', 'https://my-manual.okinoko.io');
		expect(isManualMode('indexer')).toBe(true);
		expect(resolveNodeUrl('indexer')).toBe('https://my-manual.okinoko.io');
	});
	it('legacy migration: manual key set + no mode key → manual', () => {
		localStorage.setItem('node-auto-vsc', 'https://cached-vsc.vsc.eco');
		localStorage.setItem('vsc-gql-url', 'https://legacy-custom.vsc.eco');
		expect(isManualMode('vsc')).toBe(true);
		expect(resolveNodeUrl('vsc')).toBe('https://legacy-custom.vsc.eco');
	});
	it('autoSelectedNodeUrl ignores manual override (cache → env first)', () => {
		expect(autoSelectedNodeUrl('indexer')).toBe('https://idx-default');
		localStorage.setItem('node-auto-indexer', 'https://cached-idx');
		localStorage.setItem('node-mode-indexer', 'manual');
		localStorage.setItem('magi-indexer-url', 'https://my-manual');
		expect(autoSelectedNodeUrl('indexer')).toBe('https://cached-idx');
	});
	it('explicit auto mode is respected even if a legacy key lingers', () => {
		localStorage.setItem('vsc-gql-url', 'https://legacy-custom');
		localStorage.setItem('node-mode-vsc', 'auto');
		localStorage.setItem('node-auto-vsc', 'https://cached-vsc');
		expect(isManualMode('vsc')).toBe(false);
		expect(resolveNodeUrl('vsc')).toBe('https://cached-vsc');
	});
});

describe('refreshNode', () => {
	// refreshNode now probes server-side via GET /api/node-probe, so we stub
	// the global fetch rather than the (server-only) probe functions.
	it('probes and writes cache + timestamp when stale', async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => ({ url: 'https://picked-vsc' })
		}));
		vi.stubGlobal('fetch', fetchMock);
		await refreshNode('vsc');
		expect(fetchMock).toHaveBeenCalledWith('/api/node-probe?category=vsc&network=vsc-mainnet');
		expect(localStorage.getItem('node-auto-vsc')).toBe('https://picked-vsc');
		expect(Number(localStorage.getItem('node-auto-ts-vsc'))).toBeGreaterThan(0);
	});
	it('skips probing when cache is fresh', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		localStorage.setItem('node-auto-hive', 'https://still-good');
		localStorage.setItem('node-auto-ts-hive', String(Date.now()));
		await refreshNode('hive');
		expect(fetchMock).not.toHaveBeenCalled();
		expect(localStorage.getItem('node-auto-hive')).toBe('https://still-good');
	});
	it('skips probing in manual mode', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		localStorage.setItem('node-mode-vsc', 'manual');
		await refreshNode('vsc');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('orderedNodeUrls', () => {
	it('puts the selected node first and keeps the rest as failover', () => {
		localStorage.setItem('node-auto-indexer', 'https://idx-2');
		expect(orderedNodeUrls('indexer')).toEqual(['https://idx-2', 'https://idx-default']);
	});
	it('never repeats the selected node', () => {
		expect(orderedNodeUrls('indexer')).toEqual(['https://idx-default', 'https://idx-2']);
	});
	it('gqlEndpoints appends the service path to every node', () => {
		expect(gqlEndpoints('indexer')).toEqual([
			'https://idx-default/v1/graphql',
			'https://idx-2/v1/graphql'
		]);
		expect(gqlEndpoints('vsc')).toEqual(['https://vsc-default/api/v1/graphql']);
	});
});

describe('network scoping', () => {
	it('defaults to mainnet and follows the network toggle', () => {
		expect(currentNetwork()).toBe('vsc-mainnet');
		localStorage.setItem('vsc-network-id', 'vsc-testnet');
		expect(currentNetwork()).toBe('vsc-testnet');
	});
	it('resolves testnet nodes when the toggle is set', () => {
		localStorage.setItem('vsc-network-id', 'vsc-testnet');
		expect(resolveNodeUrl('vsc')).toBe('https://vsc-testnet-node');
		expect(gqlEndpoints('vsc')).toEqual(['https://vsc-testnet-node/api/v1/graphql']);
	});
	it("keeps the two networks' auto caches apart", () => {
		localStorage.setItem('node-auto-vsc', 'https://mainnet-cached');
		localStorage.setItem('vsc-network-id', 'vsc-testnet');
		// The mainnet cache must not leak into testnet resolution.
		expect(resolveNodeUrl('vsc')).toBe('https://vsc-testnet-node');
		localStorage.setItem('node-auto-vsc-testnet', 'https://testnet-cached');
		expect(resolveNodeUrl('vsc')).toBe('https://testnet-cached');
		localStorage.setItem('vsc-network-id', 'vsc-mainnet');
		expect(resolveNodeUrl('vsc')).toBe('https://mainnet-cached');
	});
	it('probes per network', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: 'https://t' }) }));
		vi.stubGlobal('fetch', fetchMock);
		localStorage.setItem('vsc-network-id', 'vsc-testnet');
		await refreshNode('vsc');
		expect(fetchMock).toHaveBeenCalledWith('/api/node-probe?category=vsc&network=vsc-testnet');
		expect(localStorage.getItem('node-auto-vsc-testnet')).toBe('https://t');
		expect(localStorage.getItem('node-auto-vsc')).toBeNull();
	});
});
