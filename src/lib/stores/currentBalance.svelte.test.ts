/**
 * Regression test: switching account must re-target the balance poller.
 *
 * `startAccountPolling` captures `auth` in the interval closure. It used to
 * bail out on a global `isPolling` flag, so after an account switch the OLD
 * interval kept running with the OLD auth and rewrote the previous account's
 * balances into the store every 5s — the dashboard showed the previous
 * account's numbers forever. It now keys on the polled DID, tears the old loop
 * down, and drops responses that arrive after a switch.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

const getAccountsMock = vi.fn();
vi.mock('$lib/magiTransactions/dhive', () => ({
	DHive: { database: { getAccounts: (names: string[]) => getAccountsMock(names) } }
}));

const { accountBalance, startAccountPolling, stopAccountPolling } =
	await import('./currentBalance');

type AuthLike = Parameters<typeof startAccountPolling>[0];

const authFor = (username: string): AuthLike =>
	({
		status: 'authenticated',
		value: {
			address: username,
			username,
			did: `hive:${username}`,
			provider: 'aioha',
			logout: async () => {},
			openSettings: () => {}
		}
	}) as unknown as AuthLike;

/** Per-account HBD, so the store content identifies whose balance landed. */
const HBD_BY_ACCOUNT: Record<string, number> = { alice: 1111, bob: 2222 };

/** Bumped between ticks to prove a later poll actually reaches the store. */
let hbdDrift = 0;

function accountFromBody(body: unknown): string {
	const text = typeof body === 'string' ? body : '';
	const match = text.match(/hive:(\w+)/);
	return match ? match[1] : 'alice';
}

beforeEach(() => {
	hbdDrift = 0;
	getAccountsMock.mockImplementation(async (names: string[]) => [
		{ balance: '0.000 HIVE', hbd_balance: '0.000 HBD', name: names[0] }
	]);
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init?: { body?: unknown }) => {
			const account = accountFromBody(init?.body);
			return new Response(
				JSON.stringify({
					data: {
						getAccountBalance: {
							hbd: (HBD_BY_ACCOUNT[account] ?? 0) + hbdDrift,
							hbd_savings: 0,
							hbd_claim: 0,
							pending_hbd_unstaking: 0,
							hive: 0,
							hive_consensus: 0,
							consensus_unstaking: 0
						},
						getAccountRC: { amount: 10, block_height: 1 },
						getStateByKeys: {}
					}
				}),
				{ status: 200 }
			);
		})
	);
});

afterEach(() => {
	stopAccountPolling();
	vi.unstubAllGlobals();
});

/** Let the in-flight fetch chain settle. */
const settle = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
	await new Promise((r) => setTimeout(r, 20));
};

describe('startAccountPolling', () => {
	// Releasing the Houdini cache subscription (queryOnce) must NOT stop the
	// recurring refresh: the auto-update comes from the 5s interval writing
	// into `accountBalance`, not from the cache pushing into the query store.
	it('keeps auto-refreshing on the interval after the cache subscription is released', async () => {
		vi.useFakeTimers();
		try {
			startAccountPolling(authFor('alice'));
			await vi.advanceTimersByTimeAsync(0);
			expect(get(accountBalance).bal.hbd).toBe(1111);

			// Balance changes on chain between ticks.
			hbdDrift = 500;
			await vi.advanceTimersByTimeAsync(5000);
			expect(get(accountBalance).bal.hbd).toBe(1611);

			hbdDrift = 900;
			await vi.advanceTimersByTimeAsync(5000);
			expect(get(accountBalance).bal.hbd).toBe(2011);
		} finally {
			stopAccountPolling();
			vi.useRealTimers();
		}
	});

	it('follows the account the user switched to', async () => {
		startAccountPolling(authFor('alice'));
		await settle();
		expect(get(accountBalance).bal.hbd).toBe(HBD_BY_ACCOUNT.alice);

		startAccountPolling(authFor('bob'));
		await settle();
		expect(get(accountBalance).bal.hbd).toBe(HBD_BY_ACCOUNT.bob);
	});

	it('ignores a response that lands after the switch', async () => {
		startAccountPolling(authFor('alice'));
		// Switch before alice's request can resolve.
		startAccountPolling(authFor('bob'));
		await settle();
		expect(get(accountBalance).bal.hbd).toBe(HBD_BY_ACCOUNT.bob);
	});

	it('does not restart the interval for the same account', async () => {
		startAccountPolling(authFor('alice'));
		await settle();
		const callsAfterFirst = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock
			.calls.length;
		startAccountPolling(authFor('alice'));
		await settle();
		expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
			callsAfterFirst
		);
	});
});
