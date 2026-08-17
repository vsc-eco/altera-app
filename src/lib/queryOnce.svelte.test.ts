/**
 * Regression test for the "site hangs after ~1h" leak.
 *
 * `new SomeQueryStore().fetch()` registers the document as a Houdini cache
 * subscriber and only releases it when the store's last Svelte subscriber goes
 * away. Fire-and-forget pollers never subscribe, so before `queryOnce` every
 * tick added a permanent subscriber (11 for GetAccountBalance, several hundred
 * for GetTransactions) and every later cache write re-read the whole selection
 * once per leaked subscriber.
 *
 * These tests pin both halves: the leak exists with a bare `.fetch()`, and
 * `queryOnce` leaves the cache exactly as it found it while still returning
 * the data.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GetAccountBalanceStore } from '$houdini';
import cache from '$houdini/runtime/cache';
import { queryOnce } from '$lib/queryOnce';

/** Total cache subscribers across every record/field in the shared cache. */
function countSubscriptions(): number {
	const subs = (
		cache as unknown as {
			_internal_unstable: {
				subscriptions: { subscribers: Map<string, Map<string, { selections: unknown[] }>> };
			};
		}
	)._internal_unstable.subscriptions.subscribers;
	let total = 0;
	for (const [, fields] of subs) {
		for (const [, field] of fields) total += field.selections.length;
	}
	return total;
}

const balancePayload = (rc: number) => ({
	data: {
		getAccountBalance: {
			hbd: 100,
			hbd_savings: 0,
			hbd_claim: 0,
			pending_hbd_unstaking: 0,
			hive: 5,
			hive_consensus: 0,
			consensus_unstaking: 0
		},
		// Vary a field per call — Houdini only notifies subscribers of fields
		// that actually changed, so a constant payload would hide the cost.
		getAccountRC: { amount: 1000 + rc, block_height: 42 + rc }
	}
});

describe('queryOnce', () => {
	beforeEach(() => {
		let n = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify(balancePayload(n++)), { status: 200 }))
		);
	});

	it('a bare .fetch() per poll leaks a cache subscription every time', async () => {
		const before = countSubscriptions();
		for (let i = 0; i < 5; i++) {
			await new GetAccountBalanceStore().fetch({
				variables: { account: 'hive:leaky' },
				policy: 'NetworkOnly'
			});
		}
		// 11 selected fields per poll, never released.
		expect(countSubscriptions() - before).toBe(55);
	});

	it('leaves no subscription behind, however many times it runs', async () => {
		const before = countSubscriptions();
		for (let i = 0; i < 5; i++) {
			await queryOnce(new GetAccountBalanceStore(), {
				variables: { account: 'hive:clean' },
				policy: 'NetworkOnly'
			});
			expect(countSubscriptions()).toBe(before);
		}
	});

	it('still returns the query result', async () => {
		const res = await queryOnce(new GetAccountBalanceStore(), {
			variables: { account: 'hive:clean' },
			policy: 'NetworkOnly'
		});
		expect(res.data?.getAccountBalance?.hbd).toBe(100);
		expect(res.data?.getAccountRC?.amount).toBeGreaterThan(0);
	});
});
