import { beforeEach, describe, expect, it, vi } from 'vitest';

// The node, as the two one-shot queries rcSizing makes: the account's RC and
// the newest election. Each test sets what the node answers.
class GetAccountBalanceStore {}
class ActiveConsensusStore {}
class SimulateContractCallsStore {}
vi.mock('$houdini', () => ({
	GetAccountBalanceStore,
	ActiveConsensusStore,
	SimulateContractCallsStore
}));

let rc: number | undefined | Error;
let election: { version_major: number; protocol_version: number } | undefined | Error;
const asked: string[] = [];
vi.mock('$lib/queryOnce', () => ({
	queryOnce: async (store: object) => {
		if (store instanceof ActiveConsensusStore) {
			asked.push('election');
			if (election instanceof Error) throw election;
			return { data: election ? { electionByBlockHeight: { epoch: 1, ...election } } : null };
		}
		asked.push('rc');
		if (rc instanceof Error) throw rc;
		return { data: rc === undefined ? null : { getAccountRC: { amount: rc } } };
	}
}));

const {
	BTC_PAYOUT_SWAP_MIN_RC,
	BTC_PAYOUT_SWAP_MIN_RC_V0_15,
	fetchActiveConsensus,
	fetchBtcPayoutSwapMinRc,
	sizeBtcPayoutSwap
} = await import('./rcSizing');

const DID = 'hive:someone';

beforeEach(() => {
	rc = undefined;
	election = undefined;
	asked.length = 0;
});

describe('fetchActiveConsensus', () => {
	it("reads the newest election's version", async () => {
		election = { version_major: 0, protocol_version: 15 };
		expect(await fetchActiveConsensus()).toEqual({ major: 0, consensus: 15 });
	});

	it('is undefined when the node answers nothing or fails', async () => {
		election = undefined;
		expect(await fetchActiveConsensus()).toBeUndefined();
		election = new Error('node down');
		expect(await fetchActiveConsensus()).toBeUndefined();
	});
});

describe('fetchBtcPayoutSwapMinRc', () => {
	it('follows the chain', async () => {
		election = { version_major: 0, protocol_version: 14 };
		expect(await fetchBtcPayoutSwapMinRc()).toBe(BTC_PAYOUT_SWAP_MIN_RC);
		election = { version_major: 0, protocol_version: 15 };
		expect(await fetchBtcPayoutSwapMinRc()).toBe(BTC_PAYOUT_SWAP_MIN_RC_V0_15);
	});

	it('is the original minimum when the election cannot be read', async () => {
		election = new Error('node down');
		expect(await fetchBtcPayoutSwapMinRc()).toBe(BTC_PAYOUT_SWAP_MIN_RC);
	});
});

describe('sizeBtcPayoutSwap', () => {
	it('before consensus 0.15 refuses an account with only the free 10,000 RC', async () => {
		rc = 10_000;
		election = { version_major: 0, protocol_version: 14 };
		expect(await sizeBtcPayoutSwap(DID, 0)).toEqual({
			ok: false,
			reason: 'insufficient-rc',
			needed: BTC_PAYOUT_SWAP_MIN_RC,
			available: 10_000
		});
	});

	it('from consensus 0.15 lets the same account through', async () => {
		rc = 10_000;
		election = { version_major: 0, protocol_version: 15 };
		expect(await sizeBtcPayoutSwap(DID, 0)).toEqual({ ok: true, rcLimit: 10_000 });
		expect(asked.sort()).toEqual(['election', 'rc']);
	});

	it('from consensus 0.15 still counts an HBD input pulled from Magi', async () => {
		// 12 HBD on Magi and the free 10,000: swapping all 12 HBD leaves the
		// free 10,000 for RC, enough at the new minimum.
		rc = 22_000;
		election = { version_major: 0, protocol_version: 15 };
		expect(await sizeBtcPayoutSwap(DID, 12_000)).toEqual({ ok: true, rcLimit: 10_000 });
	});

	it('refuses at the original minimum when the election cannot be read', async () => {
		rc = 10_000;
		election = new Error('node down');
		expect(await sizeBtcPayoutSwap(DID, 0)).toMatchObject({
			ok: false,
			needed: BTC_PAYOUT_SWAP_MIN_RC
		});
	});

	it('uses the polled RC when the node does not answer for the account', async () => {
		rc = undefined;
		election = { version_major: 0, protocol_version: 15 };
		expect(await sizeBtcPayoutSwap(DID, 0, 9_000)).toEqual({ ok: true, rcLimit: 9_000 });
	});
});
