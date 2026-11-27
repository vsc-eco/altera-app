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

const { accountBalance, evmMinDeposit, evmProofFee, startAccountPolling, stopAccountPolling } =
	await import('./currentBalance');
const { ETH_CHAIN_ID, USDC_TOKEN_ADDRESS } = await import('$lib/constants');
const USDC_REGISTRY_KEY = `t-${ETH_CHAIN_ID}-${USDC_TOKEN_ADDRESS.slice(2).toLowerCase()}`;
let registry: Record<string, string> = {};

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
	registry = { [USDC_REGISTRY_KEY]: 'usdc|6|3000000|0|200000' };
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
								'pf-usdc': '150000',
								...registry
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
	evmMinDeposit.set({ eth: 1_000_000_000_000_000, usdc: null });
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

	it('reads the minimum deposits: ETH 0.001, a token a tenth of its minimum withdrawal', async () => {
		startAccountPolling(alice);
		await settle();
		// 3 USDC minimum withdrawal -> 0.3 USDC minimum deposit (DUST-1).
		expect(get(evmMinDeposit)).toEqual({ eth: 1_000_000_000_000_000, usdc: 300_000 });
	});

	it('leaves the USDC minimum unknown (no deposit offered) when its registry entry is missing', async () => {
		registry = {};
		evmMinDeposit.set({ eth: 1_000_000_000_000_000, usdc: 999 }); // a stale value must not survive
		startAccountPolling(alice);
		await settle();
		expect(get(evmMinDeposit).usdc).toBeNull();
	});
});
