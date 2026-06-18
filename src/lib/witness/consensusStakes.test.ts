import { describe, it, expect, beforeEach, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('$houdini', () => ({
	GetTransactionsStore: class {
		fetch = fetchMock;
	}
}));

import { fetchStakesByNode } from './consensusStakes';

function op(type: string, data: Record<string, unknown>) {
	return { type, data, index: 0 };
}
function tx(status: string, ops: ReturnType<typeof op>[]) {
	return { status, type: 'hive', ops };
}

beforeEach(() => {
	fetchMock.mockReset();
});

describe('fetchStakesByNode', () => {
	it('nets stake − unstake per node, ignores bundled deposit/withdraw ops', async () => {
		fetchMock.mockResolvedValue({
			data: {
				findTransaction: [
					tx('CONFIRMED', [
						op('deposit', { amount: 19000000, asset: 'hive', to: 'hive:lordbutterfly' }),
						op('consensus_stake', { amount: '19000.000', to: 'hive:magi-team-node' })
					]),
					tx('CONFIRMED', [
						op('consensus_stake', { amount: '1000.000', to: 'hive:magi-team-node' })
					]),
					tx('CONFIRMED', [
						op('consensus_unstake', { amount: '5000.000', to: 'hive:magi-team-node' })
					]),
					tx('CONFIRMED', [op('consensus_stake', { amount: '2000.000', to: 'hive:other-node' })])
				]
			}
		});

		const result = await fetchStakesByNode('hive:lordbutterfly');

		// 19000 + 1000 − 5000 = 15000 (node), 2000 (other), sorted desc, hive: stripped
		expect(result).toEqual([
			{ node: 'magi-team-node', staked: 15000 },
			{ node: 'other-node', staked: 2000 }
		]);
	});

	it('skips FAILED txs and drops nodes that net to zero', async () => {
		fetchMock.mockResolvedValue({
			data: {
				findTransaction: [
					tx('FAILED', [op('consensus_stake', { amount: '9999.000', to: 'hive:magi-team-node' })]),
					tx('CONFIRMED', [op('consensus_stake', { amount: '100.000', to: 'hive:drained' })]),
					tx('CONFIRMED', [op('consensus_unstake', { amount: '100.000', to: 'hive:drained' })])
				]
			}
		});

		const result = await fetchStakesByNode('hive:lordbutterfly');
		expect(result).toEqual([]);
	});

	it('returns empty when there are no consensus ops', async () => {
		fetchMock.mockResolvedValue({ data: { findTransaction: [] } });
		const result = await fetchStakesByNode('hive:nobody');
		expect(result).toEqual([]);
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
