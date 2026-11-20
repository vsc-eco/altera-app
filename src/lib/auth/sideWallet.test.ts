import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Conn = { connector: { uid: string; id: string } };
const h = vi.hoisted(() => ({
	cfg: null as null | { storage: { setItem: (k: string, v: unknown) => Promise<void> } },
	conns: [] as { connector: { uid: string; id: string } }[],
	onChange: null as null | (() => void)
}));

vi.mock('$lib/auth/reown', () => ({
	get wagmiConfig() {
		return h.cfg;
	}
}));
vi.mock('@wagmi/core', () => ({
	getConnections: () => [...h.conns],
	disconnect: vi.fn(async (_cfg: unknown, { connector }: { connector: Conn['connector'] }) => {
		h.conns = h.conns.filter((c) => c.connector.uid !== connector.uid);
	}),
	watchConnections: (_cfg: unknown, { onChange }: { onChange: () => void }) => {
		h.onChange = onChange;
		return () => (h.onChange = null);
	}
}));

const { withSideWallet, sideWalletActive, wagmiConnectorId } = await import('./sideWallet');
const core = await import('@wagmi/core');

const store = new Map<string, string>();
beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	store.clear();
	h.cfg = null;
	h.conns = [];
	h.onChange = null;
	(globalThis as unknown as { localStorage: unknown }).localStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	};
});
afterEach(async () => {
	await vi.runAllTimersAsync();
	vi.useRealTimers();
});

describe('withSideWallet', () => {
	it('maps window.ethereum to wagmi\'s "injected" connector and keeps EIP-6963 rdns', () => {
		expect(wagmiConnectorId('window.ethereum')).toBe('injected');
		expect(wagmiConnectorId('io.metamask')).toBe('io.metamask');
	});

	it('Reown not started: returns the result and leaves wagmi\'s own "disconnected" flag', async () => {
		const r = await withSideWallet('io.metamask', async () => 'hash');
		expect(r).toBe('hash');
		expect(store.get('wagmi.io.metamask.disconnected')).toBe('true');
	});

	it('Reown running: disconnects a connection the send created, also one arriving late', async () => {
		const setItem = vi.fn(async () => {});
		h.cfg = { storage: { setItem } };
		await withSideWallet('io.metamask', async () => {
			expect(sideWalletActive()).toBe(true);
			h.conns.push({ connector: { uid: 'u1', id: 'io.metamask' } }); // wagmi connected on accountsChanged
			return 'hash';
		});
		expect(h.conns).toEqual([]);
		expect(setItem).toHaveBeenCalledWith('io.metamask.disconnected', true);
		// wagmi's connect event can land after the send returned
		expect(sideWalletActive()).toBe(true);
		h.conns.push({ connector: { uid: 'u2', id: 'io.metamask' } });
		h.onChange?.();
		await vi.advanceTimersByTimeAsync(10);
		expect(h.conns).toEqual([]);
		await vi.advanceTimersByTimeAsync(5000);
		expect(sideWalletActive()).toBe(false);
	});

	it("never touches the user's own Reown connection, nor flags a wallet that is the login", async () => {
		const setItem = vi.fn(async () => {});
		h.cfg = { storage: { setItem } };
		h.conns = [{ connector: { uid: 'mine', id: 'io.metamask' } }];
		await withSideWallet('io.metamask', async () => 'hash');
		await vi.advanceTimersByTimeAsync(6000);
		expect(core.disconnect).not.toHaveBeenCalled();
		expect(h.conns.map((c) => c.connector.uid)).toEqual(['mine']);
		expect(setItem).not.toHaveBeenCalled();
	});

	it('a failed send still cleans up and its error reaches the caller', async () => {
		h.cfg = { storage: { setItem: vi.fn(async () => {}) } };
		await expect(
			withSideWallet('io.rabby', async () => {
				h.conns.push({ connector: { uid: 'u3', id: 'io.rabby' } });
				throw new Error('User rejected the request.');
			})
		).rejects.toThrow('User rejected the request.');
		expect(h.conns).toEqual([]);
	});
});
