/**
 * Tests for fetchPoolFees — the read-side fee layer.
 *
 * Pins:
 *   1. range → pre-aggregated view selection (24h / 7d / 30d / all-time)
 *   2. view-column → PoolAssetFee mapping (protocol_fees → magiFee,
 *      lp_fees → lpFee, node_fees → nodeFee, network_fees → networkFee)
 *   3. the fallback: indexers that haven't deployed node_fees/network_fees
 *      hard-error on the unknown field, so we retry the legacy shape and
 *      report node/network as 0 rather than returning empty fees.
 *
 * The network boundary (`hasuraQueryRaw`) is mocked; it returns the raw
 * `{ data, errors }` envelope so the fallback path can be exercised.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const hasuraQueryRawMock = vi.fn();
vi.mock('./query', () => ({
	hasuraQuery: vi.fn(),
	hasuraQueryRaw: (...args: unknown[]) => hasuraQueryRawMock(...args)
}));

const { fetchPoolFees } = await import('./poolQueries');

afterEach(() => hasuraQueryRawMock.mockReset());

const POOL = 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp';
const ok = (data: unknown) => ({ data, errors: null });

describe('fetchPoolFees — view selection', () => {
	it.each([
		['1d', 'dex_pool_fees_by_asset_24h'],
		['7d', 'dex_pool_fees_by_asset_7d'],
		['30d', 'dex_pool_fees_by_asset_30d'],
		['max', 'dex_pool_fees_by_asset']
	] as const)('range %s queries the %s view', async (range, view) => {
		hasuraQueryRawMock.mockResolvedValue(ok({ [view]: [] }));
		await fetchPoolFees(POOL, range);
		const sentQuery = hasuraQueryRawMock.mock.calls[0][0] as string;
		expect(sentQuery).toContain(`${view}(where:`);
		expect(hasuraQueryRawMock.mock.calls[0][1]).toEqual({ pool: POOL });
	});
});

describe('fetchPoolFees — column mapping (split columns present)', () => {
	it('maps lp/protocol/node/network per asset', async () => {
		hasuraQueryRawMock.mockResolvedValue(
			ok({
				dex_pool_fees_by_asset_7d: [
					{
						asset: 'hive',
						protocol_fees: 15681,
						lp_fees: 105,
						node_fees: 11747,
						network_fees: 3934
					},
					{ asset: 'hbd', protocol_fees: 277, lp_fees: 0, node_fees: 215, network_fees: 62 }
				]
			})
		);
		const out = await fetchPoolFees(POOL, '7d');
		expect(out).toEqual([
			{ asset: 'hive', lpFee: 105, magiFee: 15681, nodeFee: 11747, networkFee: 3934 },
			{ asset: 'hbd', lpFee: 0, magiFee: 277, nodeFee: 215, networkFee: 62 }
		]);
		// node + network reconcile to protocol_fees on pendulum rows (per tibfox).
		expect(out[0].nodeFee + out[0].networkFee).toBe(out[0].magiFee);
	});

	it('requests node_fees/network_fees on the first attempt', async () => {
		hasuraQueryRawMock.mockResolvedValue(ok({ dex_pool_fees_by_asset_7d: [] }));
		await fetchPoolFees(POOL, '7d');
		expect(hasuraQueryRawMock.mock.calls[0][0]).toContain('node_fees');
		expect(hasuraQueryRawMock.mock.calls[0][0]).toContain('network_fees');
	});

	it('coerces string-encoded numerics', async () => {
		hasuraQueryRawMock.mockResolvedValue(
			ok({
				dex_pool_fees_by_asset_30d: [
					{
						asset: 'hive',
						protocol_fees: '5000',
						lp_fees: '40',
						node_fees: '3700',
						network_fees: '1300'
					}
				]
			})
		);
		const [hive] = await fetchPoolFees(POOL, '30d');
		expect(hive).toEqual({
			asset: 'hive',
			lpFee: 40,
			magiFee: 5000,
			nodeFee: 3700,
			networkFee: 1300
		});
	});

	it('drops null-asset rows defensively', async () => {
		hasuraQueryRawMock.mockResolvedValue(
			ok({
				dex_pool_fees_by_asset_7d: [
					{ asset: null, protocol_fees: 99, lp_fees: 9, node_fees: 70, network_fees: 29 },
					{ asset: 'hive', protocol_fees: 10, lp_fees: 1, node_fees: 7, network_fees: 3 }
				]
			})
		);
		const out = await fetchPoolFees(POOL, '7d');
		expect(out).toEqual([{ asset: 'hive', lpFee: 1, magiFee: 10, nodeFee: 7, networkFee: 3 }]);
	});

	it('returns [] when the view has no rows / missing key', async () => {
		hasuraQueryRawMock.mockResolvedValue(ok({ dex_pool_fees_by_asset_7d: [] }));
		expect(await fetchPoolFees(POOL, '7d')).toEqual([]);
		hasuraQueryRawMock.mockResolvedValue(ok({}));
		expect(await fetchPoolFees(POOL, '7d')).toEqual([]);
	});
});

describe('fetchPoolFees — fallback for indexers without the split columns', () => {
	it('retries the legacy shape and reports node/network as 0', async () => {
		// First attempt: indexer rejects node_fees → GraphQL error.
		hasuraQueryRawMock.mockResolvedValueOnce({
			data: null,
			errors: [{ message: "field 'node_fees' not found in type: 'dex_pool_fees_by_asset_7d'" }]
		});
		// Retry (legacy): protocol_fees + lp_fees only.
		hasuraQueryRawMock.mockResolvedValueOnce(
			ok({ dex_pool_fees_by_asset_7d: [{ asset: 'hive', protocol_fees: 15681, lp_fees: 105 }] })
		);
		const out = await fetchPoolFees(POOL, '7d');
		// Two attempts: the rich query, then the legacy retry.
		expect(hasuraQueryRawMock).toHaveBeenCalledTimes(2);
		expect(hasuraQueryRawMock.mock.calls[1][0]).not.toContain('node_fees');
		// Protocol total preserved; split reads 0 (no columns to split by).
		expect(out).toEqual([{ asset: 'hive', lpFee: 105, magiFee: 15681, nodeFee: 0, networkFee: 0 }]);
	});

	it('does NOT retry on an unrelated error (avoids masking real failures)', async () => {
		hasuraQueryRawMock.mockResolvedValueOnce({
			data: null,
			errors: [{ message: 'connection refused' }]
		});
		const out = await fetchPoolFees(POOL, '7d');
		expect(hasuraQueryRawMock).toHaveBeenCalledTimes(1);
		expect(out).toEqual([]);
	});
});
