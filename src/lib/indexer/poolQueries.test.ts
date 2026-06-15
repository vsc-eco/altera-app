/**
 * Tests for fetchPoolFees — the read-side fee fix.
 *
 * Pins the two things the 2026-06-12 rewrite is responsible for:
 *   1. range → pre-aggregated view selection (24h / 7d / 30d / all-time)
 *   2. view-column → PoolAssetFee mapping (protocol_fees → magiFee,
 *      lp_fees → lpFee), which is what fixed the "$0.02 / 7d" bug where
 *      the pendulum-era NULL `magi_fee` zeroed out the protocol fee.
 *
 * The network boundary (`hasuraQuery`) is mocked; the per-view response
 * key is keyed by the same view name the query selects.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const hasuraQueryMock = vi.fn();
vi.mock('./query', () => ({
	hasuraQuery: (...args: unknown[]) => hasuraQueryMock(...args)
}));

const { fetchPoolFees } = await import('./poolQueries');

afterEach(() => hasuraQueryMock.mockReset());

// Sample matching tibfox's live 7d payload shape for the HIVE pool.
const POOL = 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp';

describe('fetchPoolFees — view selection', () => {
	it.each([
		['1d', 'dex_pool_fees_by_asset_24h'],
		['7d', 'dex_pool_fees_by_asset_7d'],
		['30d', 'dex_pool_fees_by_asset_30d'],
		['max', 'dex_pool_fees_by_asset']
	] as const)('range %s queries the %s view', async (range, view) => {
		hasuraQueryMock.mockResolvedValue({ [view]: [] });
		await fetchPoolFees(POOL, range);
		const sentQuery = hasuraQueryMock.mock.calls[0][0] as string;
		expect(sentQuery).toContain(`${view}(where:`);
		// pool id passed as a variable, not interpolated
		expect(hasuraQueryMock.mock.calls[0][1]).toEqual({ pool: POOL });
	});
});

describe('fetchPoolFees — column mapping', () => {
	it('maps protocol_fees → magiFee and lp_fees → lpFee per asset', async () => {
		hasuraQueryMock.mockResolvedValue({
			dex_pool_fees_by_asset_7d: [
				{ asset: 'hive', protocol_fees: 16947, lp_fees: 113 },
				{ asset: 'hbd', protocol_fees: 990, lp_fees: 1 }
			]
		});
		const out = await fetchPoolFees(POOL, '7d');
		expect(out).toEqual([
			{ asset: 'hive', magiFee: 16947, lpFee: 113 },
			{ asset: 'hbd', magiFee: 990, lpFee: 1 }
		]);
	});

	it('treats the protocol fee as a real value (not the old NULL magi_fee)', async () => {
		// The bug: pendulum rows have protocol fee in protocol_fees, NOT
		// magi_fee. The old code read magi_fee → 0. This asserts the bulk
		// of the fee now lands in magiFee.
		hasuraQueryMock.mockResolvedValue({
			dex_pool_fees_by_asset_7d: [{ asset: 'btc', protocol_fees: 18738, lp_fees: 159 }]
		});
		const [btc] = await fetchPoolFees(POOL, '7d');
		expect(btc.magiFee).toBe(18738);
		expect(btc.magiFee).toBeGreaterThan(btc.lpFee);
	});

	it('coerces string-encoded numerics (Hasura may return NUMERIC as string)', async () => {
		hasuraQueryMock.mockResolvedValue({
			dex_pool_fees_by_asset_30d: [{ asset: 'hive', protocol_fees: '5000', lp_fees: '40' }]
		});
		const [hive] = await fetchPoolFees(POOL, '30d');
		expect(hive).toEqual({ asset: 'hive', magiFee: 5000, lpFee: 40 });
	});

	it('drops null-asset rows defensively', async () => {
		hasuraQueryMock.mockResolvedValue({
			dex_pool_fees_by_asset_7d: [
				{ asset: null, protocol_fees: 99, lp_fees: 9 },
				{ asset: 'hive', protocol_fees: 10, lp_fees: 1 }
			]
		});
		const out = await fetchPoolFees(POOL, '7d');
		expect(out).toEqual([{ asset: 'hive', magiFee: 10, lpFee: 1 }]);
	});

	it('returns [] when the view has no rows for the pool', async () => {
		hasuraQueryMock.mockResolvedValue({ dex_pool_fees_by_asset_7d: [] });
		expect(await fetchPoolFees(POOL, '7d')).toEqual([]);
	});

	it('returns [] when the response is missing the view key', async () => {
		hasuraQueryMock.mockResolvedValue({});
		expect(await fetchPoolFees(POOL, '7d')).toEqual([]);
	});
});
