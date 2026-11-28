import { beforeEach, describe, expect, it, vi } from 'vitest';

const raw = vi.fn();
vi.mock('./query', () => ({ hasuraQueryRaw: (...a: unknown[]) => raw(...a) }));
const { fetchEvmDepositsByRecipient, recipientForms } = await import('./evmMappingQueries');

const row = (o: Record<string, unknown> = {}) => ({
	indexer_ts: '2026-11-21T00:07:00',
	indexer_contract_id: 'vsc1BqoXD32CWWx9UBfh18TnN7Es85RBut2Uhr',
	indexer_tx_hash: 'bafy1',
	indexer_block_height: 100,
	amount: '940000000000000',
	recipient: 'hive:lordbutterfly',
	sender: '0x00000000000000000000000000000000000000a1',
	asset: 'eth',
	l1_block: 21234567,
	l1_tx_index: 42,
	...o
});

beforeEach(() => raw.mockReset());

describe('fetchEvmDepositsByRecipient', () => {
	it('asks for the account in every form the bridge may key it by', async () => {
		raw.mockResolvedValue({ data: { evm_mapping_deposit_events: [row()] } });
		const rows = await fetchEvmDepositsByRecipient('hive:lordbutterfly', 20);
		expect(rows).toHaveLength(1);
		expect(raw.mock.calls[0][1]).toMatchObject({ recipients: ['hive:lordbutterfly'], limit: 20 });
	});

	it('an Ethereum account: as given and checksummed (the bridge keys by the checksummed DID)', () => {
		const lower = 'did:pkh:eip155:1:0x5979fd2165668a309f5cac914dfecd63621a7b28';
		expect(recipientForms(lower)).toEqual([
			lower,
			'did:pkh:eip155:1:0x5979fd2165668A309F5cAc914DFEcd63621a7B28'
		]);
	});

	it('the indexer does not have the table yet: no rows and no error logged', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		raw.mockResolvedValue({
			data: null,
			errors: [{ message: "field 'evm_mapping_deposit_events' not found in type: 'query_root'" }]
		});
		expect(await fetchEvmDepositsByRecipient('hive:a', 20)).toEqual([]);
		expect(err).not.toHaveBeenCalled();
		err.mockRestore();
	});

	it('only ETH and USDC rows are shown', async () => {
		raw.mockResolvedValue({
			data: { evm_mapping_deposit_events: [row(), row({ asset: 'usdc' }), row({ asset: 'dai' })] }
		});
		const rows = await fetchEvmDepositsByRecipient('hive:lordbutterfly', 20);
		expect(rows.map((r) => r.asset)).toEqual(['eth', 'usdc']);
	});
});
