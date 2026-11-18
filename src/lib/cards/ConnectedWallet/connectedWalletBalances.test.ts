import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	fetchBtcBalance,
	connectedWalletLabel,
	truncateAddress,
	walletAssetDecimals,
	formatWalletAmount,
	walletAssetName
} from './connectedWalletBalances';
import type { Auth } from '$lib/auth/store';

const BTC_ADDR = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const EVM_ADDR = '0x31160b3fF46E7406D7B28af9128b0407e05C376e';

/** The shape `getAuth()()` hands components, cut down to what these read. */
function auth(value: Partial<NonNullable<Auth['value']>> | undefined): Auth {
	return { status: value ? 'authenticated' : 'none', value } as Auth;
}

function mockMempool(body: unknown, ok = true) {
	const spy = vi.fn().mockResolvedValue({
		ok,
		status: ok ? 200 : 502,
		json: async () => body
	});
	vi.stubGlobal('fetch', spy);
	return spy;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchBtcBalance', () => {
	it('reports the spendable balance, not the funded total', async () => {
		// 1.0 BTC confirmed in, 0.25 spent → 0.75 spendable.
		mockMempool({
			chain_stats: { funded_txo_sum: 100_000_000, spent_txo_sum: 25_000_000 },
			mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 }
		});
		const rows = await fetchBtcBalance(BTC_ADDR);
		expect(rows).toEqual([{ symbol: 'BTC', amount: 0.75, icon: '/btc/btc.svg' }]);
	});

	it('does not count unconfirmed incoming coins as spendable', async () => {
		// The old version added mempool funding to the headline figure, so the
		// portfolio quoted 0.6 while the swap card's Max quoted 0.5.
		mockMempool({
			chain_stats: { funded_txo_sum: 50_000_000, spent_txo_sum: 0 },
			mempool_stats: { funded_txo_sum: 10_000_000, spent_txo_sum: 0 }
		});
		const rows = await fetchBtcBalance(BTC_ADDR);
		expect(rows[0].amount).toBe(0.5);
	});

	it('shows unconfirmed incoming coins as a separate pending row', async () => {
		mockMempool({
			chain_stats: { funded_txo_sum: 50_000_000, spent_txo_sum: 0 },
			mempool_stats: { funded_txo_sum: 10_000_000, spent_txo_sum: 0 }
		});
		const rows = await fetchBtcBalance(BTC_ADDR);
		expect(rows).toHaveLength(2);
		expect(rows[1]).toMatchObject({ symbol: 'BTC', amount: 0.1, sub: 'pending' });
	});

	it('subtracts a pending outgoing payment and adds no pending row', async () => {
		mockMempool({
			chain_stats: { funded_txo_sum: 50_000_000, spent_txo_sum: 0 },
			mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 20_000_000 }
		});
		const rows = await fetchBtcBalance(BTC_ADDR);
		expect(rows).toHaveLength(1);
		expect(rows[0].amount).toBe(0.3);
	});

	it('throws rather than reporting an empty wallet when the API fails', async () => {
		// A swallowed error used to render as "nothing in this wallet", which a
		// user acts on without checking.
		mockMempool({}, false);
		await expect(fetchBtcBalance(BTC_ADDR)).rejects.toThrow();
	});

	it('reads testnet addresses from the testnet API', async () => {
		const spy = mockMempool({
			chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
			mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 }
		});
		await fetchBtcBalance('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
		expect(spy.mock.calls[0][0]).toContain('/testnet/api/');
	});
});

describe('connectedWalletLabel', () => {
	it('names a Hive account', () => {
		expect(
			connectedWalletLabel(auth({ provider: 'aioha', username: 'tibfox', address: 'tibfox' }))
		).toEqual({ chain: 'Hive', account: '@tibfox' });
	});

	it('names a Bitcoin wallet by its truncated address', () => {
		expect(
			connectedWalletLabel(
				auth({
					provider: 'reown',
					address: BTC_ADDR,
					did: `did:pkh:bip122:000000000019d6689c085ae165831e93:${BTC_ADDR}`
				})
			)
		).toEqual({ chain: 'Bitcoin', account: truncateAddress(BTC_ADDR) });
	});

	it('names an EVM wallet — the case the redesign showed nothing for', () => {
		expect(
			connectedWalletLabel(
				auth({ provider: 'reown', address: EVM_ADDR, did: `did:pkh:eip155:1:${EVM_ADDR}` })
			)
		).toEqual({ chain: 'Ethereum', account: truncateAddress(EVM_ADDR) });
	});

	it('is undefined when nobody is signed in', () => {
		expect(connectedWalletLabel(auth(undefined))).toBeUndefined();
	});
});

describe('truncateAddress', () => {
	it('keeps both ends so the address can be checked by eye', () => {
		const out = truncateAddress(EVM_ADDR);
		expect(out.startsWith('0x31160b')).toBe(true);
		expect(out.endsWith('5C376e')).toBe(true);
	});

	it('leaves a short string alone rather than making it longer', () => {
		expect(truncateAddress('0xabc')).toBe('0xabc');
	});

	it('is empty for an empty address', () => {
		expect(truncateAddress('')).toBe('');
	});
});

describe('amount formatting', () => {
	it('gives BTC its 8 places and ETH 6', () => {
		expect(walletAssetDecimals('BTC')).toBe(8);
		expect(walletAssetDecimals('ETH')).toBe(6);
		expect(walletAssetDecimals('HIVE')).toBe(3);
	});

	it('pads to the asset precision so a column lines up', () => {
		expect(formatWalletAmount(0.5, 'BTC')).toBe('0.50000000');
		expect(formatWalletAmount(1, 'HIVE')).toBe('1.000');
	});

	it('names an asset, with its qualifier when there is one', () => {
		expect(walletAssetName('HBD')).toBe('Hive Backed Dollar');
		expect(walletAssetName('BTC', 'pending')).toBe('Bitcoin · pending');
		expect(walletAssetName('WAT')).toBe('WAT');
	});
});
