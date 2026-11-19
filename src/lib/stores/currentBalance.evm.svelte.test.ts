/**
 * The balance poller reads the EVM bridge's ledger for ETH and USDC, and its
 * pf-<asset> proving fees in the same query (the withdraw max leaves room for
 * them, prooffee.go charges them on top of every withdrawal).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/constants', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/constants')>()),
	EVM_BRIDGE_ENABLED: true,
	EVM_BRIDGE_CONTRACT_ID: 'vsc1bridge'
}));
vi.mock('$lib/magiTransactions/dhive', () => ({
	DHive: {
		database: {
			getAccounts: async (names: string[]) => [
				{ balance: '0.000 HIVE', hbd_balance: '0.000 HBD', name: names[0] }
			]
		}
	}
}));

const { accountBalance, evmProofFee, startAccountPolling, stopAccountPolling } =
	await import('./currentBalance');

type AuthLike = Parameters<typeof startAccountPolling>[0];
const alice = {
	status: 'authenticated',
	value: {
		address: 'alice',
		username: 'alice',
		did: 'hive:alice',
		provider: 'aioha',
		logout: async () => {},
		openSettings: () => {}
	}
} as unknown as AuthLike;

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							getAccountBalance: { hbd: 1000, hive: 0 },
							getAccountRC: { amount: 10, block_height: 1 },
							getStateByKeys: {
								'a-hive:alice-eth': '1500000000000000000',
								'a-hive:alice-usdc': '2500000',
								'pf-eth': '50000000000000',
								'pf-usdc': '150000'
							}
						}
					}),
					{ status: 200 }
				)
		)
	);
});

afterEach(() => {
	stopAccountPolling();
	vi.unstubAllGlobals();
	evmProofFee.set({ eth: 0, usdc: 0 });
});

const settle = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
	await new Promise((r) => setTimeout(r, 20));
};

describe('EVM bridge balances', () => {
	it('reads the account ETH and USDC in smallest units', async () => {
		startAccountPolling(alice);
		await settle();
		expect(get(accountBalance).bal.eth).toBe(1_500_000_000_000_000_000);
		expect(get(accountBalance).bal.usdc).toBe(2_500_000);
	});

	it('reads the proving fees in the same query', async () => {
		startAccountPolling(alice);
		await settle();
		expect(get(evmProofFee)).toEqual({ eth: 50_000_000_000_000, usdc: 150_000 });
		const bodies = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
			.map((c) => String((c[1] as { body?: unknown })?.body ?? ''))
			.filter((b) => b.includes('pf-eth'));
		expect(bodies.length).toBeGreaterThan(0);
		expect(bodies[0]).toContain('a-hive:alice-eth');
	});
});
